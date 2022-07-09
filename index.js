"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

require("core-js/modules/web.dom-collections.iterator.js");

require("core-js/modules/es.object.assign.js");

require("core-js/modules/es.promise.js");

require("core-js/modules/es.promise.finally.js");

require("core-js/modules/es.regexp.exec.js");

require("core-js/modules/es.string.split.js");

var _axios = _interopRequireDefault(require("axios"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

class AjaxManager {
  // TODO delete
  constructor(config) {
    _defineProperty(this, "instance", null);

    _defineProperty(this, "stop", false);

    _defineProperty(this, "requests", []);

    _defineProperty(this, "events", {});

    _defineProperty(this, "checks", {});

    _defineProperty(this, "processes", {});

    _defineProperty(this, "defaultHandlers", {});

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
    this.requests = this.requests.filter(_ref => {
      let [x] = _ref;
      return x !== r;
    });
  }

  addToRequests(r, action) {
    this.requests.push([r, action]);
  }

  static createInstance(config) {
    return _axios.default.create(config || {
      timeout: 1000
    });
  }

  static createAjaxStatus(name) {
    return {
      REQUEST: "".concat(name, " REQUEST"),
      SUCCESS: "".concat(name, " SUCCESS"),
      FAILURE: "".concat(name, " FAILURE"),
      ERROR: "".concat(name, " ERROR"),
      CANCELED: "".concat(name, " CANCELED"),
      LOADED: "".concat(name, " LOADED"),
      RESET: "".concat(name, " RESET")
    };
  }

  static createBasicAjaxState() {
    let data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
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
      params: {}
    };
  }

  create() {
    let createConfig = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    const $this = this;
    const {
      axiosConfig = {},
      name = '',
      defaultData = null,
      transform = {},
      check = {},
      process = {},
      resetOnRquest = true,
      events = {}
    } = createConfig;
    const {
      onFinal
    } = Object.assign({}, this.getEvents(), events);
    if (!name) throw new Error('config.name is not set');
    const defaultState = AjaxManager.createBasicAjaxState(defaultData);
    const ajaxStatus = AjaxManager.createAjaxStatus(name);

    const config = _objectSpread({}, axiosConfig);

    const {
      REQUEST,
      SUCCESS,
      FAILURE,
      ERROR,
      LOADED,
      CANCELED,
      RESET
    } = ajaxStatus;
    const actions = {
      async request(context, params) {
        if ($this.getStop()) return;
        const {
          state: curState,
          commit
        } = context;

        if (curState.onFetch && curState.tokenSource) {
          commit(CANCELED);
        }

        const cancelTokenSource = _axios.default.CancelToken.source();

        commit(REQUEST, {
          cancelTokenSource,
          params
        });
        config.cancelToken = cancelTokenSource.token;

        if (transform.url) {
          config.url = transform.url(config.url, params, context);
        }

        const method = config.method || 'get';
        const methodDataKey = method === 'get' ? 'params' : 'data';
        config.method = method;
        config[methodDataKey] = params;
        if (!config.data) config.data = {};
        const r = $this.instance(config).then(response => {
          let isFailure = false;

          const checkFailure = check.failure || $this.checks.failure || (x => x);

          if (checkFailure) {
            isFailure = checkFailure(response);
          }

          if (isFailure) {
            const processFailure = process.failure || $this.processes.failure || (x => x);

            commit(FAILURE, processFailure(response, context));
          } else {
            const processSuccess = process.success || $this.processes.success || (x => x);

            commit(SUCCESS, processSuccess(response, context));
          }
        }).catch(e => {
          if (!_axios.default.isCancel(e)) {
            const processError = process.error || $this.processes.error || (x => x);

            commit(ERROR, processError(e, context));
          }
        }).finally(() => {
          if (onFinal) onFinal(dispatch, context);
          $this.updateRequests(r);
          commit(LOADED);
        });
        $this.addToRequests(r, () => commit(CANCELED));
        return r;
      },

      async cancel(_ref2) {
        let {
          state: curState,
          commit
        } = _ref2;

        if (curState.tokenSource) {
          await curState.tokenSource.cancel('');
        }

        commit(CANCELED);
      },

      reset(_ref3) {
        let {
          state: curState,
          commit
        } = _ref3;

        if (curState.onFetch && curState.tokenSource) {
          commit(CANCELED);
        }

        commit(RESET);
      }

    };
    const mutations = {
      [REQUEST](state, _ref4) {
        let {
          cancelTokenSource,
          params
        } = _ref4;
        const defaultState = AjaxManager.createBasicAjaxState(defaultData);
        defaultState.onFetch = true;
        if (!resetOnRquest) defaultState.data = state.data;
        defaultState.tokenSource = cancelTokenSource;
        defaultState.params = params;
        Object.keys(defaultState).forEach(key => {
          state[key] = defaultState[key];
        });
      },

      [SUCCESS](state, payload) {
        const {
          data,
          status,
          headers
        } = payload;
        state.onFetch = false;
        state.data = data;
        state.status = status;
        state.headers = headers;
      },

      [FAILURE](state, payload) {
        const {
          data,
          status,
          headers
        } = payload;
        state.error = true;
        state.onFetch = false;
        state.message = data === null || data === void 0 ? void 0 : data.message;
        state.data = data;
        state.status = status;
        state.headers = headers;
      },

      [ERROR](state, payload) {
        const {
          data,
          response,
          status,
          headers
        } = payload;
        state.error = true;
        state.onFetch = false;
        state.message = data === null || data === void 0 ? void 0 : data.message;
        state.data = data || payload;
        state.status = (response === null || response === void 0 ? void 0 : response.status) || status;
        state.headers = (response === null || response === void 0 ? void 0 : response.headers) || headers;
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
        Object.keys(defaultState).forEach(key => {
          state[key] = defaultState[key];
        });
      }

    };
    const state = defaultState;
    return {
      state,
      actions,
      mutations,
      namespaced: true
    };
  }

  dynamicCreate(path, moduleOptions) {
    const $this = this;
    const actions = {
      create(_, id) {
        const modulePath = [...path.split('.'), id];

        if (!this.hasModule(modulePath)) {
          if (moduleOptions.name) moduleOptions.name = "".concat(moduleOptions.name, " ").concat(id);
          this.registerModule(modulePath, $this.create(moduleOptions));
        }

        return (actionName, params) => {
          this.dispatch(modulePath.join('/') + '/' + actionName, params);
        };
      }

    };
    return {
      state: {},
      actions,
      namespaced: true
    };
  }

}

var _default = AjaxManager;
exports.default = _default;
