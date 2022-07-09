import axios from 'axios';

class AjaxManager {
  instance = null;

  stop = false;
  requests = [];
  events = {};
  checks = {};
  processes = {};

  // TODO delete
  defaultHandlers = {};

  constructor(config) {
    this.instance = AjaxManager.createInstance(config);
  }

  getInstance() {
    return this.instance;
  }

  getStop() {
    return this.stop;
  }

  setEvents(events) {
    this.events = events;
  }

  getEvents() {
    return this.events;
  }

  setChecks(checks) {
    this.checks = checks;
  }

  getChecks() {
    return this.checks;
  }

  setProcesses(processes) {
    this.processes = processes;
  }

  getProcesses() {
    return this.processes;
  }

  updateRequests(r) {
    this.requests = this.requests.filter(([x]) => x !== r);
  }

  addToRequests(r, action) {
    this.requests.push([r, action]);
  }

  static createInstance(config) {
    return axios.create(
      config || {
        timeout: 1000,
      }
    );
  }

  static createAjaxStatus(name) {
    return {
      REQUEST: `${name} REQUEST`,
      SUCCESS: `${name} SUCCESS`,
      FAILURE: `${name} FAILURE`,
      ERROR: `${name} ERROR`,
      CANCELED: `${name} CANCELED`,
      LOADED: `${name} LOADED`,
      RESET: `${name} RESET`,
    };
  }

  static createBasicAjaxState(data = null) {
    return {
      onFetch: false,
      error: false,
      message: '',
      loaded: false,
      data,
      headers: {},
      status: null,
      canceled: false,
      tokenSource: null,
      params: {},
    };
  }

  create(createConfig = {}) {
    const $this = this;
    const {
      axiosConfig = {},
      name = '',
      defaultData = null,
      transform = {},
      check = {},
      process = {},
      resetOnRquest = true,
      events = {},
    } = createConfig;

    const { onFinal } = Object.assign({}, this.getEvents(), events);

    if (!name) throw new Error('config.name is not set');

    const defaultState = AjaxManager.createBasicAjaxState(defaultData);
    const ajaxStatus = AjaxManager.createAjaxStatus(name);
    const config = { ...axiosConfig };

    const { REQUEST, SUCCESS, FAILURE, ERROR, LOADED, CANCELED, RESET } = ajaxStatus;

    const actions = {
      async request(context, params) {
        if ($this.getStop()) return;
        const { state: curState, commit } = context;
        if (curState.onFetch && curState.tokenSource) {
          commit(CANCELED);
        }

        const cancelTokenSource = axios.CancelToken.source();
        commit(REQUEST, { cancelTokenSource, params });
        config.cancelToken = cancelTokenSource.token;

        if (transform.url) {
          config.url = transform.url(config.url, params, context);
        }

        const method = config.method || 'get';
        const methodDataKey = method === 'get' ? 'params' : 'data';
        config.method = method;
        config[methodDataKey] = params;

        if (!config.data) config.data = {};

        const r = $this
          .instance(config)
          .then((response) => {
            let isFailure = false;
            const checkFailure = check.failure || $this.checks.failure || ((x) => x);
            if (checkFailure) {
              isFailure = checkFailure(response);
            }

            if (isFailure) {
              const processFailure = process.failure || $this.processes.failure || ((x) => x);
              commit(FAILURE, processFailure(response, context));
            } else {
              const processSuccess = process.success || $this.processes.success || ((x) => x);
              commit(SUCCESS, processSuccess(response, context));
            }
          })
          .catch((e) => {
            if (!axios.isCancel(e)) {
              const processError = process.error || $this.processes.error || ((x) => x);
              commit(ERROR, processError(e, context));
            }
          })
          .finally(() => {
            if (onFinal) onFinal(dispatch, context);
            $this.updateRequests(r);
            commit(LOADED);
          });

        $this.addToRequests(r, () => commit(CANCELED));
        return r;
      },
      async cancel({ state: curState, commit }) {
        if (curState.tokenSource) {
          await curState.tokenSource.cancel('');
        }
        commit(CANCELED);
      },
      reset({ state: curState, commit }) {
        if (curState.onFetch && curState.tokenSource) {
          commit(CANCELED);
        }
        commit(RESET);
      },
    };

    const mutations = {
      [REQUEST](state, { cancelTokenSource, params }) {
        const defaultState = AjaxManager.createBasicAjaxState(defaultData);
        defaultState.onFetch = true;
        if (!resetOnRquest) defaultState.data = state.data;
        defaultState.tokenSource = cancelTokenSource;
        defaultState.params = params;
        Object.keys(defaultState).forEach((key) => {
          state[key] = defaultState[key];
        });
      },
      [SUCCESS](state, payload) {
        const { data, status, headers } = payload;
        state.onFetch = false;
        state.data = data;
        state.status = status;
        state.headers = headers;
      },
      [FAILURE](state, payload) {
        const { data, status, headers } = payload;
        state.error = true;
        state.onFetch = false;
        state.message = data?.message;
        state.data = data;
        state.status = status;
        state.headers = headers;
      },
      [ERROR](state, payload) {
        const { data, response, status, headers } = payload;
        state.error = true;
        state.onFetch = false;
        state.message = data?.message;
        state.data = data || payload;
        state.status = response?.status || status;
        state.headers = response?.headers || headers;
      },
      [LOADED](state) {
        state.loaded = true;
      },
      [CANCELED](state) {
        state.onFetch = false;
        state.tokenSource = null;
        state.canceled = true;
      },
      [RESET](state) {
        const defaultState = AjaxManager.createBasicAjaxState(defaultData);
        Object.keys(defaultState).forEach((key) => {
          state[key] = defaultState[key];
        });
      },
    };

    const state = defaultState;

    return { state, actions, mutations, namespaced: true };
  }

  dynamicCreate(path, moduleOptions) {
    const $this = this;
    const actions = {
      create(_, id) {
        const modulePath = [...path.split('.'), id];
        if (!this.hasModule(modulePath)) {
          if (moduleOptions.name) moduleOptions.name = `${moduleOptions.name} ${id}`;
          this.registerModule(modulePath, $this.create(moduleOptions));
        }
        return (actionName, params) => {
          this.dispatch(modulePath.join('/') + '/' + actionName, params);
        };
      },
    };
    return { state: {}, actions, namespaced: true };
  }
}

export default AjaxManager;
