(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
var MiwoExtension, component, di, http, utils,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

di = require('./di');

http = require('./http');

component = require('./component');

utils = require('./utils');

MiwoExtension = (function(_super) {
  __extends(MiwoExtension, _super);

  function MiwoExtension() {
    return MiwoExtension.__super__.constructor.apply(this, arguments);
  }

  MiwoExtension.prototype.init = function() {
    this.setConfig({
      http: {
        params: {},
        plugins: {
          redirect: http.plugins.RedirectPlugin,
          failure: http.plugins.FailurePlugin,
          error: http.plugins.ErrorPlugin
        }
      },
      cookie: {
        document: null
      },
      di: {
        services: {}
      },
      flash: {
        renderer: null
      }
    });
  };

  MiwoExtension.prototype.build = function(injector) {
    var config, name, namespace, service, _ref;
    config = this.config;
    namespace = window[injector.params.namespace];
    if (!namespace) {
      namespace = {};
      window[injector.params.namespace] = namespace;
    }
    if (!namespace.components) {
      namespace.components = {};
    }
    if (!namespace.controllers) {
      namespace.controllers = {};
    }
    _ref = config.di.services;
    for (name in _ref) {
      service = _ref[name];
      injector.setGlobal(name, service);
    }
    injector.define('http', http.HttpRequestManager, function(service) {
      var plugin, _ref1;
      service.params = config.http.params;
      _ref1 = config.http.plugins;
      for (name in _ref1) {
        plugin = _ref1[name];
        if (plugin) {
          service.plugin(new plugin());
        }
      }
    });
    injector.define('cookie', http.CookieManager, function(service) {
      if (config.cookie.document) {
        service.document = config.cookie.document;
      }
    });
    injector.define('componentMgr', component.ComponentManager);
    injector.define('componentStateMgr', component.StateManager);
    injector.define('componentStatePersister', component.StatePersister);
    injector.define('componentSelector', component.ComponentSelector);
    injector.define('zIndexMgr', component.ZIndexManager);
    injector.define('flash', utils.FlashNotificator, function(service) {
      if (config.flash.renderer) {
        service.renderer = config.flash.renderer;
      }
    });
  };

  return MiwoExtension;

})(di.InjectorExtension);

module.exports = MiwoExtension;


},{"./component":12,"./di":24,"./http":29,"./utils":44}],3:[function(require,module,exports){
var Configurator, InjectorFactory;

InjectorFactory = require('../di/InjectorFactory');

Configurator = (function() {
  Configurator.prototype.miwo = null;

  Configurator.prototype.injectorFactory = null;

  function Configurator(miwo) {
    this.miwo = miwo;
    this.injectorFactory = new InjectorFactory();
  }

  Configurator.prototype.createInjector = function() {
    var injector;
    injector = this.injectorFactory.createInjector();
    this.miwo.setInjector(injector);
    return injector;
  };

  Configurator.prototype.setExtension = function(name, extension) {
    this.injectorFactory.setExtension(name, extension);
  };

  Configurator.prototype.setConfig = function(config) {
    this.injectorFactory.setConfig(config);
  };

  return Configurator;

})();

module.exports = Configurator;


},{"../di/InjectorFactory":22}],4:[function(require,module,exports){
var Configurator, Miwo, Translator;

Configurator = require('./Configurator');

Translator = require('../locale/Translator');

Miwo = (function() {
  Miwo.service = function(name, service) {
    Object.defineProperty(this.prototype, name, {
      configurable: true,
      get: function() {
        return this.service(service || name);
      }
    });
  };

  Miwo.prototype.body = null;

  Miwo.prototype.baseUrl = '';

  Miwo.prototype.http = Miwo.service('http');

  Miwo.prototype.cookie = Miwo.service('cookie');

  Miwo.prototype.flash = Miwo.service('flash');

  Miwo.prototype.zIndexMgr = Miwo.service('zIndexMgr');

  Miwo.prototype.storeMgr = Miwo.service('storeMgr');

  Miwo.prototype.proxyMgr = Miwo.service('proxyMgr');

  Miwo.prototype.entityMgr = Miwo.service('entityMgr');

  Miwo.prototype.componentMgr = Miwo.service('componentMgr');

  Miwo.prototype.componentStateMgr = Miwo.service('componentStateMgr');

  Miwo.prototype.componentSelector = Miwo.service('componentSelector');

  Miwo.prototype.windowMgr = Miwo.service('windowMgr');

  Miwo.prototype.application = Miwo.service('application');

  Miwo.prototype.translator = null;

  Miwo.prototype.injector = null;

  Miwo.prototype.extensions = null;

  function Miwo() {
    this.ready((function(_this) {
      return function() {
        return _this.body = document.getElementsByTagName('body')[0];
      };
    })(this));
    this.extensions = {};
    this.translator = new Translator();
    return;
  }

  Miwo.prototype.ready = function(callback) {
    window.on('domready', callback);
  };

  Miwo.prototype.tr = function(key) {
    return this.translator.get(key);
  };

  Miwo.prototype.require = function(file) {
    var data, e;
    data = miwo.http.read(this.baseUrl + file + "?t=" + (new Date().getTime()));
    try {
      eval(data);
    } catch (_error) {
      e = _error;
      throw new Error("Cant require file " + file + ", data are not evaluable. Reason " + (e.getMessage()));
    }
  };

  Miwo.prototype.redirect = function(code, params) {
    this.application.redirect(code, params);
  };

  Miwo.prototype.get = function(id) {
    return this.componentMgr.get(id);
  };

  Miwo.prototype.async = function(callback) {
    return setTimeout((function(_this) {
      return function() {
        callback();
      };
    })(this), 1);
  };

  Miwo.prototype.query = function(selector) {
    var component, result, _i, _len, _ref;
    _ref = this.componentMgr.roots;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      component = _ref[_i];
      if (component.isContainer) {
        result = this.componentSelector.query(selector, component);
        if (result) {
          return result;
        }
      } else if (component.is(selector)) {
        return component;
      }
    }
    return null;
  };

  Miwo.prototype.queryAll = function(selector) {
    var component, results, _i, _len, _ref;
    results = [];
    _ref = this.componentMgr.roots;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      component = _ref[_i];
      if (component.isContainer) {
        results.append(this.componentSelector.queryAll(selector, component));
      } else if (component.is(selector)) {
        results.push(component);
      }
    }
    return results;
  };

  Miwo.prototype.service = function(name) {
    return this.injector.get(name);
  };

  Miwo.prototype.store = function(name) {
    return this.storeMgr.get(name);
  };

  Miwo.prototype.proxy = function(name) {
    return this.proxyMgr.get(name);
  };

  Miwo.prototype.registerExtension = function(name, extension) {
    this.extensions[name] = extension;
  };

  Miwo.prototype.createConfigurator = function() {
    var configurator, extension, name, _ref;
    configurator = new Configurator(this);
    _ref = this.extensions;
    for (name in _ref) {
      extension = _ref[name];
      configurator.setExtension(name, new extension());
    }
    return configurator;
  };

  Miwo.prototype.setInjector = function(injector) {
    var name, service, _ref;
    this.injector = injector;
    this.injector.set('translator', this.translator);
    _ref = injector.globals;
    for (name in _ref) {
      service = _ref[name];
      Miwo.service(name, service);
    }
  };

  Miwo.prototype.init = function(onInit) {
    var configurator, injector;
    if (this.injector) {
      return this.injector;
    }
    configurator = this.createConfigurator();
    if (onInit) {
      onInit(configurator);
    }
    injector = configurator.createInjector();
    return injector;
  };

  return Miwo;

})();

module.exports = new Miwo;


},{"../locale/Translator":38,"./Configurator":3}],5:[function(require,module,exports){
var Component, MiwoObject,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __slice = [].slice;

MiwoObject = require('../core/Object');

Component = (function(_super) {
  __extends(Component, _super);

  Component.prototype.isComponent = true;

  Component.prototype.xtype = 'component';

  Component.prototype.id = null;

  Component.prototype.name = null;

  Component.prototype.width = void 0;

  Component.prototype.height = void 0;

  Component.prototype.top = null;

  Component.prototype.left = null;

  Component.prototype.right = null;

  Component.prototype.bottom = null;

  Component.prototype.padding = null;

  Component.prototype.margin = null;

  Component.prototype.html = null;

  Component.prototype.styles = null;

  Component.prototype.cls = null;

  Component.prototype.baseCls = "";

  Component.prototype.componentCls = "";

  Component.prototype.container = null;

  Component.prototype.el = "div";

  Component.prototype.contentEl = null;

  Component.prototype.parentEl = null;

  Component.prototype.focusEl = null;

  Component.prototype.rendered = false;

  Component.prototype.rendering = false;

  Component.prototype.autoFocus = false;

  Component.prototype.zIndex = null;

  Component.prototype.zIndexManage = false;

  Component.prototype.focusOnToFront = true;

  Component.prototype.focus = false;

  Component.prototype.visible = true;

  Component.prototype.renderTo = null;

  Component.prototype.template = null;

  Component.prototype.scrollable = false;

  Component.prototype.autoCenter = false;

  Component.prototype.disabled = false;

  Component.prototype.role = null;

  Component.prototype.plugins = null;

  Component.prototype.stateManage = false;

  Component.prototype.stateName = null;

  Component.prototype._isGeneratedId = false;

  Component.prototype.zIndexMgr = null;

  Component.prototype.componentMgr = null;

  function Component(config) {
    this.plugins = {};
    this.beforeInit();
    if (!this.calledBeforeInit) {
      throw new Error("In component " + this + " you forgot call super::beforeInit()");
    }
    Component.__super__.constructor.call(this, config);
    this.doInit();
    if (!this.calledDoInit) {
      throw new Error("In component " + this + " you forgot call super::doInit()");
    }
    miwo.componentMgr.register(this);
    if (this.zIndexManage) {
      miwo.zIndexMgr.register(this);
    }
    this.afterInit();
    if (!this.calledAfterInit) {
      throw new Error("In component " + this + " you forgot call super::afterInit()");
    }
    this.callPlugins('init', this);
    return;
  }

  Component.prototype.beforeInit = function() {
    this.calledBeforeInit = true;
  };

  Component.prototype.doInit = function() {
    var stateName;
    this.calledDoInit = true;
    if (!this.name) {
      this.name = miwo.componentMgr.uniqueName(this.xtype);
    }
    if (!this.id) {
      this.id = miwo.componentMgr.uniqueId();
      this._isGeneratedId = true;
    }
    this.el = this.createElement(this.el);
    if (this.contentEl) {
      this.contentEl = this.createElement(this.contentEl);
      this.contentEl.inject(this.el);
      this.contentEl.addClass("miwo-ct");
    }
    if (this.focusEl === true) {
      this.focusEl = this.el;
    }
    if (this.stateManage) {
      stateName = this.stateName || this.id;
      if (!stateName) {
        throw new Error("Component id or stateName must be defined if you want use component states");
      }
      this.state = miwo.componentStateMgr.loadState(stateName);
    }
  };

  Component.prototype.afterInit = function() {
    var parent;
    this.calledAfterInit = true;
    if (this.component) {
      parent = this.component;
      delete this.component;
      parent.addComponent(this);
    }
  };

  Component.prototype.createElement = function(options) {
    var tag;
    if (Type.isString(options)) {
      return new Element(options);
    } else {
      tag = options.tag || "div";
      delete options.tag;
      return new Element(tag, options);
    }
  };

  Component.prototype.setId = function(id) {
    var oldId;
    this._isGeneratedId = false;
    oldId = this.id;
    if (this.id !== id) {
      this.id = id;
      this.el.set("id", id);
      this.emit('idchange', this, id, oldId);
    }
  };

  Component.prototype.getName = function() {
    return this.name;
  };

  Component.prototype.getBaseCls = function(suffix) {
    return this.baseCls + (suffix ? "-" + suffix : "");
  };

  Component.prototype.getContentEl = function() {
    return this.contentEl || this.el;
  };

  Component.prototype.setContentEl = function(el) {
    this.contentEl = el;
  };

  Component.prototype.getFocusEl = function() {
    return this.focusEl;
  };


  /* not save method
     setEl: (el) ->
  		@el = el
  		@contentEl.inject(el) if @contentEl
  		return
   */

  Component.prototype.setParentEl = function(el, position) {
    this.parentEl = (position === "after" || position === "before" ? el.getParent() : el);
    this.el.inject(el, position);
  };

  Component.prototype.getParentEl = function() {
    return this.parentEl;
  };

  Component.prototype.getElement = function(selector) {
    return this.el.getElement(selector);
  };

  Component.prototype.getElements = function(selector) {
    return this.el.getElements(selector);
  };

  Component.prototype.setZIndex = function(zIndex) {
    this.el.setStyle("z-index", zIndex);
    return zIndex + 10;
  };

  Component.prototype.getZIndex = function() {
    return parseInt(this.el.getStyle("z-index"), 10);
  };

  Component.prototype.toFront = function() {
    this.getZIndexManager().bringToFront(this);
  };

  Component.prototype.toBack = function() {
    this.getZIndexManager().sendToBack(this);
  };

  Component.prototype.getZIndexManager = function() {
    if (!this.zIndexMgr) {
      throw new Error("Component " + this.name + " is not managed with zIndexManager");
    }
    return this.zIndexMgr;
  };

  Component.prototype.setActive = function(active, newActive) {
    this.emit((active ? "activated" : "deactivated"), this);
  };

  Component.prototype.setDisabled = function(disabled) {
    this.disabled = disabled;
    this.emit("disabled", this, disabled);
    if (this.isFocusable()) {
      this.getFocusEl().set('tabindex', -disabled);
    }
  };

  Component.prototype.setFocus = function(silent) {
    if (this.disabled) {
      return;
    }
    this.focus = true;
    if (this.isFocusable()) {
      this.getFocusEl().setFocus();
    }
    if (!silent) {
      this.emit('focus', this);
    }
  };

  Component.prototype.blur = function(silent) {
    if (this.disabled) {
      return;
    }
    this.focus = false;
    if (this.isFocusable()) {
      this.getFocusEl().blur();
    }
    if (!silent) {
      this.emit('blur', this);
    }
  };

  Component.prototype.isFocusable = function() {
    return this.focusEl && this.rendered && this.isVisible();
  };

  Component.prototype.isScrollable = function() {
    if (this.scrollable === null) {
      return this.height || (this.top !== null && this.bottom !== null);
    } else {
      return this.scrollable;
    }
  };

  Component.prototype.setParent = function(parent, name) {
    if (parent === null && this.container === null && name !== null) {
      this.name = name;
      return this;
    } else if (parent === this.container && name === null) {
      return this;
    }
    if (this.container !== null && parent !== null) {
      throw new Error("Component '" + this.name + "' already has a parent '" + this.container.name + "' and you try set new parent '" + parent.name + "'.");
    }
    if (name) {
      this.name = name;
    }
    if (parent !== null) {
      this.container = parent;
      this.attachedContainer(this.container);
      this.emit('attached', this, parent);
    } else {
      this.detachedContainer(this.container);
      this.emit('detached', this);
      this.container = null;
    }
    return this;
  };

  Component.prototype.is = function(selector) {
    return miwo.componentSelector.is(this, selector);
  };

  Component.prototype.isXtype = function(xtype) {
    return this.xtype === xtype;
  };

  Component.prototype.getParent = function(selector) {
    if (selector) {
      return miwo.componentSelector.queryParent(this, selector);
    } else {
      return this.container;
    }
  };

  Component.prototype.nextSibling = function() {
    return this.getParent().nextSiblingOf(this);
  };

  Component.prototype.previousSibling = function() {
    return this.getParent().previousSiblingOf(this);
  };

  Component.prototype.attachedContainer = function(parent) {};

  Component.prototype.detachedContainer = function(parent) {};

  Component.prototype.installPlugin = function(name, plugin) {
    if (this.plugins[name]) {
      throw new Error("Plugin " + name + " already installed in component " + this);
    }
    this.plugins[name] = plugin;
  };

  Component.prototype.uninstallPlugin = function(name) {
    if (!this.plugins[name]) {
      return;
    }
    this.plugins[name].destroy();
    delete this.plugins[name];
  };

  Component.prototype.getPlugin = function(name) {
    if (!this.plugins[name]) {
      throw new Error("Plugin " + name + " is not installed in component " + this);
    }
    return this.plugins[name];
  };

  Component.prototype.hasPlugin = function(name) {
    return this.plugins[name] !== void 0;
  };

  Component.prototype.callPlugins = function() {
    var args, method, name, plugin, _ref;
    method = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    _ref = this.plugins;
    for (name in _ref) {
      plugin = _ref[name];
      if (plugin[method]) {
        plugin[method].apply(plugin, args);
      }
    }
  };

  Component.prototype.hasTemplate = function() {
    return this.template !== null;
  };

  Component.prototype.getTemplate = function() {
    if (this.template && Type.isString(this.template)) {
      this.template = this.createTemplate(this.template);
    }
    return this.template;
  };

  Component.prototype.createTemplate = function(source) {
    var template;
    template = miwo.service('templateFactory').createTemplate();
    template.setSource(source);
    template.setTarget(this.getContentEl());
    template.set("me", this);
    template.set("component", this);
    return template;
  };

  Component.prototype.update = function() {
    return this;
  };

  Component.prototype.resetRendered = function(dispose) {
    this.rendered = false;
    this.parentEl = null;
    if (dispose) {
      this.el.empty();
      this.el.dispose();
    }
    return this;
  };

  Component.prototype.render = function(el, position) {
    var contentEl;
    if (this.renderTo) {
      el = this.renderTo;
    }
    if (this.rendered) {
      return;
    }
    if (position === 'replace') {
      this.el.replaces($(el));
      this.parentEl = this.el.getParent();
    } else {
      if (el && !this.parentEl) {
        this.setParentEl(el, position);
      }
    }
    this.beforeRender();
    if (!this.calledBeforeRender) {
      throw new Error("In component " + this + " you forgot call super::beforeRender()");
    }
    this.callPlugins('beforeRender', this);
    contentEl = this.getElement('[miwo-reference="contentEl"]');
    if (contentEl) {
      this.contentEl = contentEl;
    }
    this.drawComponent();
    return this;
  };

  Component.prototype.replace = function(target) {
    target = target || $(this.id);
    if (target) {
      this.render(target, 'replace');
    }
    return this;
  };

  Component.prototype.redraw = function() {
    if (!this.rendered) {
      return;
    }
    if (this.contentEl) {
      this.contentEl.empty();
    } else {
      this.el.empty();
    }
    this.drawComponent();
    return this;
  };

  Component.prototype.drawComponent = function() {
    this.rendering = true;
    this.emit("render", this, this.el);
    this.doRender();
    this.callPlugins('doRender', this);
    this.getElements("[miwo-reference]").each((function(_this) {
      return function(el) {
        _this[el.getAttribute("miwo-reference")] = el;
        el.removeAttribute("miwo-reference");
      };
    })(this));
    this.rendered = true;
    this.rendering = false;
    this.calledAfterRender = false;
    this.afterRender();
    if (!this.calledAfterRender) {
      throw new Error("In component " + this + " you forgot call super::afterRender()");
    }
    this.callPlugins('afterRender', this);
    this.wasRendered = true;
    this.emit("rendered", this, this.getContentEl());
  };

  Component.prototype.beforeRender = function() {
    var el;
    this.calledBeforeRender = true;
    el = this.el;
    el.setVisible(this.visible);
    el.set("miwo-name", this.name);
    el.store("component", this);
    if (!this._isGeneratedId) {
      el.set("id", this.id);
    }
    if (!this.role) {
      el.set("role", this.role);
    }
    if (this.cls) {
      el.addClass(this.cls);
    }
    if (this.baseCls) {
      el.addClass(this.baseCls);
    }
    if (this.componentCls) {
      el.addClass(this.componentCls);
    }
    if (this.styles !== null) {
      el.setStyles(this.styles);
    }
    if (this.width !== null) {
      el.setStyle("width", this.width);
    }
    if (this.height !== null) {
      el.setStyle("height", this.height);
    }
    if (this.top !== null) {
      el.setStyle("top", this.top);
    }
    if (this.bottom !== null) {
      el.setStyle("bottom", this.bottom);
    }
    if (this.left !== null) {
      el.setStyle("left", this.left);
    }
    if (this.right !== null) {
      el.setStyle("right", this.right);
    }
    if (this.zIndex !== null) {
      el.setStyle("zIndex", this.zIndex);
    }
    if (this.padding !== null) {
      el.setStyle("padding", this.padding);
    }
    if (this.margin !== null) {
      el.setStyle("margin", this.margin);
    }
    this.componentMgr.beforeRender(this);
  };

  Component.prototype.doRender = function() {
    if (this.template) {
      this.getTemplate().render();
    } else if (this.html) {
      this.getContentEl().set("html", this.html);
    }
    this.getElements("[miwo-reference]").each((function(_this) {
      return function(el) {
        _this[el.getAttribute("miwo-reference")] = el;
        el.removeAttribute("miwo-reference");
      };
    })(this));
  };

  Component.prototype.afterRender = function() {
    this.calledAfterRender = true;
    this.getElements("[miwo-events]").each((function(_this) {
      return function(el) {
        var event, events, parts, _i, _len;
        events = el.getAttribute("miwo-events").split(",");
        for (_i = 0, _len = events.length; _i < _len; _i++) {
          event = events[_i];
          parts = event.split(":", 2);
          if (!_this[parts[1]]) {
            throw new Error("[Component::afterRender] In component " + _this.name + " is undefined callback '" + parts[1] + "' for event '" + parts[0] + "'");
          }
          el.on(parts[0], _this.bound(parts[1]));
        }
        el.removeAttribute("miwo-events");
      };
    })(this));
    this.componentMgr.afterRender(this);
  };

  Component.prototype.setVisible = function(visible) {
    if (visible) {
      this.show();
    } else {
      this.hide();
    }
  };

  Component.prototype.isVisible = function() {
    return this.visible;
  };

  Component.prototype.setPosition = function(pos) {
    var dsize, size;
    dsize = document.getSize();
    size = this.el.getSize();
    pos.x = Math.max(10, Math.min(pos.x, dsize.x - size.x - 10));
    this.top = pos.y;
    this.left = pos.x;
    this.el.setStyle("top", this.top);
    this.el.setStyle("left", this.left);
  };

  Component.prototype.show = function() {
    if (!this.rendered) {
      this.render();
    }
    if (this.visible) {
      return;
    }
    this.emit("show", this);
    this.doShow();
    this.parentShown(this);
    this.emit("shown", this);
    return this;
  };

  Component.prototype.showAt = function(pos) {
    this.show();
    this.setPosition(pos);
  };

  Component.prototype.doShow = function() {
    var el;
    el = this.el;
    if (this.top !== null) {
      el.setStyle("top", this.top);
    }
    if (this.bottom !== null) {
      el.setStyle("bottom", this.bottom);
    }
    if (this.left !== null) {
      el.setStyle("left", this.left);
    }
    if (this.right !== null) {
      el.setStyle("right", this.right);
    }
    el.show();
    this.visible = true;
    if ((!this.top || !this.left) && this.autoCenter) {
      this.center();
    }
  };

  Component.prototype.parentShown = function(parent) {
    this.emit("parentshown", parent);
  };

  Component.prototype.hide = function() {
    if (!this.visible) {
      return;
    }
    this.emit("hide", this);
    this.doHide();
    this.emit("hiden", this);
    return this;
  };

  Component.prototype.doHide = function() {
    this.visible = false;
    this.el.hide();
  };

  Component.prototype.center = function() {
    if (!this.left) {
      this.el.setStyle("left", (this.parentEl.getWidth() - this.el.getWidth()) / 2);
    }
    if (!this.top) {
      this.el.setStyle("top", (this.parentEl.getHeight() - this.el.getHeight()) / 2);
    }
  };

  Component.prototype.setSize = function(width, height) {
    if (Type.isObject(width)) {
      height = width.height;
      width = width.width;
    }
    if (height !== void 0 && height !== null) {
      this.height = height;
      this.el.setStyle("height", height);
    }
    if (width !== void 0 && width !== null) {
      this.width = width;
      this.el.setStyle("width", width);
    }
    this.emit("resize", this);
  };

  Component.prototype.getSize = function() {
    return;
    return {
      width: this.el.getWidth(),
      height: this.el.getHeight()
    };
  };

  Component.prototype.beforeDestroy = function() {
    this.emit("destroy", this);
    if (this.container) {
      this.container.removeComponent(this.name);
    }
    if (this.zIndexManage) {
      miwo.zIndexMgr.unregister(this);
    }
    miwo.componentMgr.unregister(this);
  };

  Component.prototype.doDestroy = function() {
    var name, plugin, _ref, _ref1;
    if (((_ref = this.template) != null ? _ref.destroy : void 0) != null) {
      this.template.destroy();
    }
    this.el.eliminate("component");
    this.el.destroy();
    _ref1 = this.plugins;
    for (name in _ref1) {
      plugin = _ref1[name];
      this.uninstallPlugin(name);
    }
  };

  Component.prototype.afterDestroy = function() {
    this.emit("destroyed", this);
  };

  return Component;

})(MiwoObject);

module.exports = Component;


},{"../core/Object":16}],6:[function(require,module,exports){
var ComponentManager, MiwoObject,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

MiwoObject = require('../core/Object');

ComponentManager = (function(_super) {
  __extends(ComponentManager, _super);

  ComponentManager.prototype.list = null;

  ComponentManager.prototype.names = null;

  ComponentManager.prototype.roots = null;

  ComponentManager.prototype.id = 1;

  function ComponentManager() {
    ComponentManager.__super__.constructor.call(this);
    this.list = {};
    this.names = {};
    this.roots = [];
    return;
  }

  ComponentManager.prototype.uniqueId = function() {
    this.id++;
    return "c" + this.id;
  };

  ComponentManager.prototype.uniqueName = function(group) {
    if (!this.names[group]) {
      this.names[group] = 0;
    }
    this.names[group]++;
    return group + this.names[group];
  };

  ComponentManager.prototype.register = function(cmp) {
    if (cmp.componentMgr) {
      throw new Error("Component " + comp + " with id " + cmp.id + " already exists.");
    }
    cmp.componentMgr = this;
    this.list[cmp.id] = cmp;
    this.roots.include(cmp);
    cmp.on('attached', (function(_this) {
      return function(cmp) {
        _this.roots.erase(cmp);
      };
    })(this));
    cmp.on('detached', (function(_this) {
      return function(cmp) {
        if (!cmp.destroying) {
          _this.roots.include(cmp);
        }
      };
    })(this));
    cmp.on('idchange', (function(_this) {
      return function(cmp, newId, oldId) {
        delete _this.list[oldId];
        _this.list[newId] = cmp;
      };
    })(this));
    this.emit("register", cmp);
  };

  ComponentManager.prototype.unregister = function(cmp) {
    if (this.roots.contains(cmp)) {
      this.roots.erase(cmp);
    }
    if (this.list[cmp.id]) {
      delete this.list[cmp.id];
      delete cmp.componentMgr;
      this.emit("unregister", cmp);
    }
  };

  ComponentManager.prototype.beforeRender = function(cmp) {
    this.emit("beforerender", cmp);
  };

  ComponentManager.prototype.afterRender = function(cmp) {
    this.emit("afterrender", cmp);
  };

  ComponentManager.prototype.get = function(id) {
    return (this.list[id] ? this.list[id] : null);
  };

  return ComponentManager;

})(MiwoObject);

module.exports = ComponentManager;


},{"../core/Object":16}],7:[function(require,module,exports){
var ComponentSelector;

ComponentSelector = (function() {
  function ComponentSelector() {}

  ComponentSelector.prototype.selectorMatch = /^([\#\.])?([^\[]*)(.*)$/;

  ComponentSelector.prototype.attributesMatch = /\[([^\]]+)\]/g;

  ComponentSelector.prototype.attributeMatch = /^\[([^=\]]+)(=([^\]]*))?\]$/;

  ComponentSelector.prototype.is = function(component, selector) {
    var attrMatches, match, matches, _i, _len, _ref;
    if (selector === '*') {
      return true;
    }
    if (!(matches = selector.match(this.selectorMatch))) {
      return false;
    }
    if (matches[2]) {
      if (matches[1] === '#') {
        if (matches[2] !== component.id) {
          return false;
        }
      } else if (matches[1] === '.') {
        if (matches[2] !== component.name) {
          return false;
        }
      } else {
        if (!component.isXtype(matches[2])) {
          return false;
        }
      }
    }
    if (matches[3]) {
      _ref = matches[3].match(this.attributesMatch);
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        match = _ref[_i];
        if (!(attrMatches = match.match(this.attributeMatch))) {
          return false;
        }
        if (attrMatches[3] === void 0) {
          if (!component[attrMatches[1]]) {
            return false;
          }
        } else {
          if (attrMatches[3].match(/^\d+$/)) {
            attrMatches[3] = parseInt(attrMatches[3], 10);
          } else if (attrMatches[3].match(/^\d+\.\d+$/)) {
            attrMatches[3] = parseFloat(attrMatches[3]);
          }
          if (component[attrMatches[1]] !== attrMatches[3]) {
            return false;
          }
        }
      }
    }
    return true;
  };

  ComponentSelector.prototype.queryParent = function(component, selector) {
    component = component.getParent();
    while (component) {
      if (component.is(selector)) {
        break;
      }
      component = component.getParent();
    }
    return component;
  };

  ComponentSelector.prototype.query = function(selector, container) {
    var component, components, nested, parts, scope, _i, _len;
    if (selector === '>' || selector === '*') {
      return container.child();
    }
    scope = container;
    parts = selector.split(' ');
    for (_i = 0, _len = parts.length; _i < _len; _i++) {
      selector = parts[_i];
      if (selector === '>') {
        nested = true;
        continue;
      }
      if (!scope.isContainer) {
        return null;
      }
      components = scope.components.toArray();
      scope = null;
      while (component = components.shift()) {
        if (component.is(selector)) {
          scope = component;
          break;
        } else if (component.isContainer && !nested) {
          components.append(component.components.toArray());
        }
      }
      if (!scope) {
        return null;
      }
      nested = false;
    }
    if (scope !== container) {
      return scope;
    } else {
      return null;
    }
  };

  ComponentSelector.prototype.queryAll = function(selector, container) {
    var component, components, matched, nested, nestedRoots, previousRoots, sel, selectors, _i, _j, _k, _l, _len, _len1, _len2, _len3, _ref;
    previousRoots = [container];
    components = container.components.toArray();
    _ref = selector.split(' ');
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      selector = _ref[_i];
      if (selector === '>') {
        nested = true;
        continue;
      }
      if (components.length === 0) {
        return [];
      }
      selectors = selector.split(',');
      nestedRoots = [];
      for (_j = 0, _len1 = components.length; _j < _len1; _j++) {
        component = components[_j];
        nestedRoots.push(component);
      }
      matched = [];
      while (component = components.shift()) {
        for (_k = 0, _len2 = selectors.length; _k < _len2; _k++) {
          sel = selectors[_k];
          if (component.is(sel) && previousRoots.indexOf(component) < 0) {
            matched.push(component);
          }
        }
        if (component.isContainer && (!nested || nestedRoots.indexOf(component) >= 0)) {
          components.append(component.components.toArray());
        }
      }
      components = matched;
      previousRoots = [];
      for (_l = 0, _len3 = components.length; _l < _len3; _l++) {
        component = components[_l];
        previousRoots.push(component);
      }
      nested = false;
    }
    return components;
  };

  return ComponentSelector;

})();

module.exports = ComponentSelector;


},{}],8:[function(require,module,exports){
var Collection, Component, Container, layout,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

layout = require('../layout');

Component = require('./Component');

Collection = require('../utils/Collection');

Container = (function(_super) {
  __extends(Container, _super);

  function Container() {
    return Container.__super__.constructor.apply(this, arguments);
  }

  Container.prototype.isContainer = true;

  Container.prototype.xtype = 'container';

  Container.prototype.layout = 'auto';

  Container.prototype.components = null;

  Container.prototype.doInit = function() {
    Container.__super__.doInit.call(this);
    this.components = new Collection();
  };

  Container.prototype.addComponent = function(name, component) {
    var error, obj;
    if (!Type.isString(name)) {
      component = name;
      name = component.name;
    }
    if (!name || !name.test(/^[a-zA-Z0-9]+$/)) {
      throw new Error("Component name must be non-empty alphanumeric string, '" + name + "' given.");
    }
    if (this.components.has(name)) {
      throw new Error("Component with name '" + name + "' already exists.");
    }
    obj = this;
    while (true) {
      if (obj === component) {
        throw new Error("Circular reference detected while adding component '" + name + "'.");
      }
      obj = obj.getParent();
      if (obj === null) {
        break;
      }
    }
    this.validateChildComponent(component);
    this.emit("add", this, component);
    try {
      this.components.set(name, component);
      component.setParent(this, name);
    } catch (_error) {
      error = _error;
      this.components.remove(name);
      console.log(error, error.stack);
      throw error;
    }
    this.addedComponent(component);
    this.addedComponentDeep(component);
    this.emit("added", this, component);
    if (this.rendered) {
      this.renderComponent(component);
    }
    return component;
  };

  Container.prototype.addedComponent = function(component) {};

  Container.prototype.addedComponentDeep = function(component) {
    if (this.container) {
      this.container.addedComponentDeep(component);
    }
  };

  Container.prototype.removeComponent = function(name) {
    var component;
    if (!this.components.has(name)) {
      throw new Error("Component named '" + name + "' is not located in this container.");
    }
    component = this.components.get(name);
    this.emit("remove", this, component);
    component.setParent(null);
    this.components.remove(name);
    this.removedComponent(component);
    this.removedComponentDeep(component);
    this.emit("removed", this, component);
  };

  Container.prototype.removeComponents = function() {
    this.components.each((function(_this) {
      return function(component, name) {
        _this.removeComponent(name);
        component.destroy();
      };
    })(this));
  };

  Container.prototype.removedComponent = function(component) {};

  Container.prototype.removedComponentDeep = function(component) {
    var parent;
    parent = this.getParent();
    if (parent) {
      parent.removedComponentDeep(component);
    }
  };

  Container.prototype.getComponent = function(name, need) {
    var component, ext, pos;
    if (need == null) {
      need = true;
    }
    if (!name) {
      throw new Error("Component or subcomponent name must not be empty string.");
    }
    ext = null;
    pos = name.indexOf("-");
    if (pos > 0) {
      ext = name.substring(pos + 1);
      name = name.substring(0, pos);
    }
    if (name === "parent") {
      if (!ext) {
        return this.component;
      } else {
        return this.component.getComponent(ext, need);
      }
    }
    if (!this.components.has(name)) {
      component = this.createComponent(name);
      if (component && component.getParent() === null) {
        this.addComponent(name, component);
      }
    }
    if (this.components.has(name)) {
      if (!ext) {
        return this.components.get(name);
      } else {
        return this.components.get(name).getComponent(ext, need);
      }
    } else if (need) {
      throw new Error("Component with name '" + name + "' does not exist.");
    }
  };

  Container.prototype.createComponent = function(name) {
    var component, method;
    method = 'createComponent' + name.capitalize();
    if (this[method]) {
      component = this[method](name);
      if (!component && !this.components.has(name)) {
        throw new Error("Method " + this + "::" + method + "() did not return or create the desired component.");
      }
      return component;
    }
    return null;
  };

  Container.prototype.hasComponents = function() {
    return this.components.length > 0;
  };

  Container.prototype.getComponents = function(asArray) {
    if (asArray) {
      return this.components.toArray();
    } else {
      return this.components;
    }
  };

  Container.prototype.findComponents = function(deep, filters, components) {
    if (deep == null) {
      deep = false;
    }
    if (filters == null) {
      filters = {};
    }
    if (components == null) {
      components = [];
    }
    this.components.each(function(component) {
      var filtered, matched, name, value;
      matched = false;
      for (name in filters) {
        value = filters[name];
        filtered = true;
        if (component[name] === value) {
          matched = true;
          break;
        }
      }
      if (!filtered || matched) {
        matched = true;
        components.push(component);
      }
      if (component.isContainer && deep) {
        component.findComponents(deep, filters, components);
      }
    });
    return components;
  };

  Container.prototype.findComponent = function(deep, filters) {
    var components;
    if (deep == null) {
      deep = false;
    }
    if (filters == null) {
      filters = {};
    }
    components = this.findComponents(deep, filters);
    if (components.length > 0) {
      return components[0];
    } else {
      return null;
    }
  };

  Container.prototype.validateChildComponent = function(child) {};

  Container.prototype.firstChild = function() {
    return this.components.getFirst();
  };

  Container.prototype.lastChild = function() {
    return this.components.getLast();
  };

  Container.prototype.nextSiblingOf = function(component) {
    var index;
    index = this.components.indexOf(component);
    return (index + 1 < this.components.length ? this.components.getAt(index + 1) : null);
  };

  Container.prototype.previousSiblingOf = function(component) {
    var index;
    index = this.components.indexOf(component);
    return (index > 0 ? this.components.getAt(index - 1) : null);
  };

  Container.prototype.find = function(selector) {
    if (selector == null) {
      selector = "*";
    }
    return miwo.componentSelector.query(selector, this);
  };

  Container.prototype.findAll = function(selector) {
    if (selector == null) {
      selector = "*";
    }
    return miwo.componentSelector.queryAll(selector, this);
  };

  Container.prototype.child = function(selector) {
    var matched;
    if (selector == null) {
      selector = "*";
    }
    matched = null;
    this.components.each((function(_this) {
      return function(component) {
        if (!matched && component.is(selector)) {
          matched = component;
        }
      };
    })(this));
    return matched;
  };

  Container.prototype.get = function(name, need) {
    if (need == null) {
      need = false;
    }
    return this.getComponent(name, need);
  };

  Container.prototype.add = function(name, component) {
    return this.addComponent(name, component);
  };

  Container.prototype.remove = function(name) {
    return this.removeComponent(name);
  };

  Container.prototype.setFocus = function() {
    Container.__super__.setFocus.call(this);
    this.focusedParent(this);
  };

  Container.prototype.focusedParent = function(parent) {
    this.components.each(function(component) {
      if (component.autoFocus) {
        component.setFocus();
      } else if (component.isContainer) {
        component.focusedParent(parent);
      }
    });
  };

  Container.prototype.update = function() {
    if (this.layout && this.layout instanceof layout.Layout) {
      this.layout.update();
    }
  };

  Container.prototype.hasLayout = function() {
    return this.layout !== null && this.layout !== false;
  };

  Container.prototype.setLayout = function(object) {
    if (object == null) {
      object = null;
    }
    if (this.layout && this.layout instanceof layout.Layout && !object) {
      this.layout.setContainer(null);
      this.layout = null;
    }
    if (object) {
      this.layout = object;
      this.layout.setContainer(this);
      this.layout.initLayout();
    }
  };

  Container.prototype.getLayout = function() {
    if (Type.isString(this.layout)) {
      this.setLayout(layout.createLayout(this.layout));
    }
    return this.layout;
  };

  Container.prototype.resetRendered = function(dispose) {
    Container.__super__.resetRendered.apply(this, arguments);
    this.components.each(function(component) {
      return component.resetRendered(dispose);
    });
  };

  Container.prototype.doRender = function() {
    Container.__super__.doRender.apply(this, arguments);
    this.renderContainer();
    this.components.each((function(_this) {
      return function(component) {
        if (!component.rendered) {
          return _this.renderComponent(component);
        }
      };
    })(this));
    if (this.layout) {
      this.getLayout().render();
    }
  };

  Container.prototype.renderContainer = function() {
    var component, el, parent, skipElement, topComponentEls, _i, _j, _k, _len, _len1, _len2, _ref, _ref1;
    topComponentEls = [];
    _ref = this.getElements("[miwo-component]");
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      el = _ref[_i];
      skipElement = false;
      if (topComponentEls.contains(el)) {
        skipElement = true;
      } else {
        _ref1 = el.getParents('[miwo-component]');
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          parent = _ref1[_j];
          if (topComponentEls.contains(parent)) {
            skipElement = true;
            continue;
          }
        }
      }
      if (!skipElement) {
        topComponentEls.push(el);
      }
    }
    for (_k = 0, _len2 = topComponentEls.length; _k < _len2; _k++) {
      el = topComponentEls[_k];
      component = this.get(el.getAttribute("miwo-component"), true);
      component.replace(el);
    }
  };

  Container.prototype.renderComponent = function(component) {
    if (!component.preventAutoRender) {
      component.render(this.getContentEl());
    }
  };

  Container.prototype.parentShown = function(parent) {
    Container.__super__.parentShown.call(this, parent);
    this.components.each(function(component) {
      component.parentShown(parent);
    });
  };

  Container.prototype.doDestroy = function() {
    this.removeComponents();
    if (this.hasLayout()) {
      this.setLayout(null);
    }
    return Container.__super__.doDestroy.call(this);
  };

  return Container;

})(Component);

module.exports = Container;


},{"../layout":37,"../utils/Collection":40,"./Component":5}],9:[function(require,module,exports){
var MiwoObject, State, StateManager,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

MiwoObject = require('../core/Object');

StateManager = (function(_super) {
  __extends(StateManager, _super);

  function StateManager() {
    return StateManager.__super__.constructor.apply(this, arguments);
  }

  StateManager.prototype.statePersister = StateManager.inject('statePersister', 'componentStatePersister');

  StateManager.prototype.loadState = function(stateName) {
    var values;
    values = this.statePersister.load(stateName);
    return new State(this, stateName, values || {});
  };

  StateManager.prototype.saveState = function(state) {
    this.statePersister.save(state.name, state.values);
  };

  return StateManager;

})(MiwoObject);

State = (function() {
  function State(mgr, name, data) {
    this.mgr = mgr;
    this.name = name;
    this.data = data;
    return;
  }

  State.prototype.get = function(name, def) {
    if (this.data.hasOwnProperty(name)) {
      return this.data[name];
    } else {
      return def;
    }
  };

  State.prototype.set = function(name, value) {
    if (value !== void 0) {
      this.data[name] = value;
    } else {
      delete this.data[name];
    }
    return this;
  };

  State.prototype.save = function() {
    this.mgr.saveState(this);
    return this;
  };

  return State;

})();

module.exports = StateManager;


},{"../core/Object":16}],10:[function(require,module,exports){
var MiwoObject, StatePersister,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

MiwoObject = require('../core/Object');

StatePersister = (function(_super) {
  __extends(StatePersister, _super);

  StatePersister.prototype.state = null;

  function StatePersister() {
    StatePersister.__super__.constructor.apply(this, arguments);
    this.state = {};
    return;
  }

  StatePersister.prototype.load = function(name) {
    return this.state[name];
  };

  StatePersister.prototype.save = function(name, data) {
    this.state[name] = data;
  };

  return StatePersister;

})(MiwoObject);

module.exports = StatePersister;


},{"../core/Object":16}],11:[function(require,module,exports){
var MiwoObject, Overlay, ZIndexManager,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

MiwoObject = require('../core/Object');

Overlay = require('../utils/Overlay');

ZIndexManager = (function(_super) {
  __extends(ZIndexManager, _super);

  ZIndexManager.prototype.zIndexBase = 10000;

  ZIndexManager.prototype.zIndex = 0;

  ZIndexManager.prototype.list = null;

  ZIndexManager.prototype.stack = null;

  ZIndexManager.prototype.front = null;

  ZIndexManager.prototype.overlay = null;

  function ZIndexManager() {
    ZIndexManager.__super__.constructor.apply(this, arguments);
    this.list = {};
    this.stack = [];
    this.zIndex = this.zIndexBase;
    return;
  }

  ZIndexManager.prototype.register = function(comp) {
    if (comp.zIndexMgr) {
      comp.zIndexMgr.unregister(comp);
    }
    comp.zIndexMgr = this;
    this.list[comp.id] = comp;
    this.stack.push(comp);
    comp.on("hide", this.bound("onComponentHide"));
  };

  ZIndexManager.prototype.unregister = function(comp) {
    if (this.list[comp.id]) {
      comp.un("hide", this.bound("onComponentHide"));
      delete this.list[comp.id];
      this.stack.erase(comp);
      delete comp.zIndexMgr;
      if (this.front === comp) {
        this.activateLast();
      }
    }
  };

  ZIndexManager.prototype.get = function(id) {
    return (id.isComponent ? id : this.list[id]);
  };

  ZIndexManager.prototype.getActive = function() {
    return this.front;
  };

  ZIndexManager.prototype.onComponentHide = function() {
    this.activateLast();
  };

  ZIndexManager.prototype.actualize = function() {
    this.zIndex = this.setZIndexies(this.zIndexBase);
  };

  ZIndexManager.prototype.setZIndexies = function(zIndex) {
    var comp, _i, _len, _ref;
    _ref = this.stack;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      comp = _ref[_i];
      zIndex = comp.setZIndex(zIndex);
    }
    this.activateLast();
    return zIndex;
  };

  ZIndexManager.prototype.setActiveChild = function(comp, oldFront) {
    if (comp !== this.front) {
      if (this.front && !this.front.destroying) {
        this.front.setActive(false, comp);
      }
      this.front = comp;
      if (comp && comp !== oldFront) {
        if (comp.focusOnToFront) {
          comp.setFocus();
        }
        comp.setActive(true);
        if (comp.modal) {
          this.showOverlay(comp);
        }
      }
    }
  };

  ZIndexManager.prototype.activateLast = function() {
    var comp, index;
    index = this.stack.length - 1;
    while (index >= 0 && !this.stack[index].isVisible()) {
      index--;
    }
    if (index >= 0) {
      comp = this.stack[index];
      this.setActiveChild(comp, this.front);
      if (comp.modal) {
        return;
      }
    } else {
      if (this.front) {
        this.front.setActive(false);
      }
      this.front = null;
    }
    while (index >= 0) {
      comp = this.stack[index];
      if (comp.isVisible() && comp.modal) {
        this.showOverlay(comp);
        return;
      }
      index--;
    }
    this.hideOverlay();
  };

  ZIndexManager.prototype.showOverlay = function(comp) {
    if (!this.overlay) {
      this.overlay = new Overlay(miwo.body);
      this.overlay.on('click', (function(_this) {
        return function() {
          if (_this.front) {
            _this.front.setFocus(true);
            if (_this.front.onOverlayClick) {
              _this.front.onOverlayClick();
            }
          }
        };
      })(this));
    }
    this.overlay.setZIndex(comp.getZIndex() - 1);
    this.overlay.open();
  };

  ZIndexManager.prototype.hideOverlay = function() {
    if (this.overlay) {
      this.overlay.close();
    }
  };

  ZIndexManager.prototype.bringToFront = function(comp) {
    var changed;
    changed = false;
    comp = this.get(comp);
    if (comp !== this.front) {
      this.stack.erase(comp);
      this.stack.push(comp);
      this.actualize();
      this.front = comp;
      changed = true;
    }
    if (changed && comp.modal) {
      this.showOverlay(comp);
    }
    return changed;
  };

  ZIndexManager.prototype.sendToBack = function(comp) {
    comp = this.get(comp);
    this.stack.erase(comp);
    this.stack.unshift(comp);
    this.actualize();
    return comp;
  };

  ZIndexManager.prototype.doDestroy = function() {
    var id;
    if (this.overlay) {
      this.overlay.destroy();
      delete this.overlay;
    }
    for (id in this.list) {
      this.unregister(this.get(id));
    }
    delete this.front;
    delete this.stack;
    delete this.list;
    ZIndexManager.__super__.doDestroy.call(this);
  };

  return ZIndexManager;

})(MiwoObject);

module.exports = ZIndexManager;


},{"../core/Object":16,"../utils/Overlay":43}],12:[function(require,module,exports){
module.exports = {
  Component: require('./Component'),
  Container: require('./Container'),
  ComponentManager: require('./ComponentManager'),
  ComponentSelector: require('./ComponentSelector'),
  ZIndexManager: require('./ZIndexManager'),
  StateManager: require('./StateManager'),
  StatePersister: require('./StatePersister')
};


},{"./Component":5,"./ComponentManager":6,"./ComponentSelector":7,"./Container":8,"./StateManager":9,"./StatePersister":10,"./ZIndexManager":11}],13:[function(require,module,exports){
Function.prototype.getter = function(prop, getter) {
  Object.defineProperty(this.prototype, prop, {
    get: getter,
    configurable: true
  });
  return null;
};

Function.prototype.setter = function(prop, setter) {
  Object.defineProperty(this.prototype, prop, {
    set: setter,
    configurable: true
  });
  return null;
};

Function.prototype.property = function(prop, def) {
  Object.defineProperty(this.prototype, prop, def);
  return null;
};

Function.prototype.inject = function(name, service) {
  if (!this.prototype.injects) {
    this.prototype.injects = {};
  }
  this.prototype.injects[name] = service || name;
  return null;
};

Number.prototype.pad = function(length, char) {
  var str;
  if (char == null) {
    char = '0';
  }
  str = '' + this;
  while (str.length < length) {
    str = char + str;
  }
  return str;
};


},{}],14:[function(require,module,exports){
var EventShortcuts;

Element.Properties.cls = {
  get: function() {
    return this.get("class");
  },
  set: function(v) {
    return this.set("class", v);
  },
  erase: function() {
    this.erase("class");
  }
};

Element.Properties.parent = {
  get: function() {
    return this.getParent();
  },
  set: function(p) {
    if (p) {
      this.inject(p);
    }
  }
};

Element.Properties.children = {
  get: function() {
    return this.getChildren();
  },
  set: function(value) {
    this.adopt(value);
  }
};

Element.Properties.location = {
  set: function(l) {
    if (l[0] !== null) {
      this.setStyle("top", l[0]);
    }
    if (l[1] !== null) {
      this.setStyle("right", l[1]);
    }
    if (l[2] !== null) {
      this.setStyle("bottom", l[2]);
    }
    if (l[3] !== null) {
      this.setStyle("left", l[3]);
    }
  }
};

Element.Properties.on = {
  set: function(o) {
    this.addEvents(o);
  }
};

Element.implement({
  isDisplayed: function() {
    return this.getStyle('display') !== 'none';
  },
  isVisible: function() {
    var h, w;
    w = this.offsetWidth;
    h = this.offsetHeight;
    if (w === 0 && h === 0) {
      return false;
    } else if (w > 0 && h > 0) {
      return true;
    } else {
      return this.style.display !== 'none';
    }
  },
  toggle: function() {
    return this[this.isDisplayed() ? 'hide' : 'show']();
  },
  hide: function() {
    var d, e;
    try {
      d = this.getStyle('display');
    } catch (_error) {
      e = _error;
    }
    if (d === 'none') {
      return this;
    }
    return this.store('element:_originalDisplay', d || '').setStyle('display', 'none');
  },
  show: function(display) {
    if (!display && this.isDisplayed()) {
      return this;
    }
    display = display || this.retrieve('element:_originalDisplay') || 'block';
    return this.setStyle('display', display === 'none' ? 'block' : display);
  },
  setVisible: function(visible) {
    this[(visible ? "show" : "hide")]();
  },
  toggleClass: function(cls, toggled) {
    if (toggled === true || toggled === false) {
      if (toggled === true) {
        if (!this.hasClass(cls)) {
          this.addClass(cls);
        }
      } else {
        if (this.hasClass(cls)) {
          this.removeClass(cls);
        }
      }
    } else {
      if (this.hasClass(cls)) {
        this.removeClass(cls);
      } else {
        this.addClass(cls);
      }
    }
    return this;
  },
  swapClass: function(remove, add) {
    return this.removeClass(remove).addClass(add);
  },
  getIndex: function(query) {
    return this.getAllPrevious(query).length;
  },
  setFocus: function(tabIndex) {
    this.setAttribute("tabIndex", tabIndex || 0);
    this.focus();
  },
  setClass: function(cls, enabled) {
    if (enabled) {
      if (!this.hasClass(cls)) {
        this.addClass(cls);
      }
    } else {
      if (this.hasClass(cls)) {
        this.removeClass(cls);
      }
    }
  }
});

EventShortcuts = {
  emit: function(type, args, delay) {
    return this.fireEvent(type, args, delay);
  },
  on: function(type, fn) {
    if (Type.isString(type)) {
      return this.addEvent(type, fn);
    } else {
      return this.addEvents(type);
    }
  },
  un: function(type, fn) {
    if (Type.isString(type)) {
      return this.removeEvent(type, fn);
    } else {
      return this.removeEvents(type);
    }
  }
};

Object.append(window, EventShortcuts);

Object.append(document, EventShortcuts);

Request.implement(EventShortcuts);

Events.implement(EventShortcuts);

Element.implement(EventShortcuts);


},{}],15:[function(require,module,exports){
var Events, NativeEvents,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __slice = [].slice;

NativeEvents = require('events');

Events = (function(_super) {
  __extends(Events, _super);

  Events.prototype.managedListeners = null;

  Events.prototype.managedRelays = null;

  Events.prototype.bounds = null;

  function Events() {
    this.managedListeners = [];
    this.managedRelays = [];
    this.bounds = {};
  }

  Events.prototype.bound = function(name) {
    if (!this.bounds[name]) {
      if (!this[name]) {
        throw new Error("Method " + name + " is undefined in object " + this);
      }
      this.bounds[name] = this[name].bind(this);
    }
    return this.bounds[name];
  };

  Events.prototype.addListener = function(name, listener) {
    if (Type.isString(listener)) {
      listener = this.bound(listener);
    }
    Events.__super__.addListener.call(this, name, listener);
  };

  Events.prototype.addListeners = function(listeners) {
    var listener, name;
    for (name in listeners) {
      listener = listeners[name];
      this.addListener(name, listener);
    }
  };

  Events.prototype.removeListener = function(name, listener) {
    if (Type.isString(listener)) {
      listener = this.bound(listener);
    }
    Events.__super__.removeListener.call(this, name, listener);
  };

  Events.prototype.removeListeners = function(name) {
    this.removeAllListeners(name);
  };

  Events.prototype.on = function(name, listener) {
    if (Type.isObject(name)) {
      this.addListeners(name);
    } else {
      this.addListener(name, listener);
    }
  };

  Events.prototype.un = function(name, listener) {
    var l, n;
    if (listener) {
      this.removeListener(name, listener);
    } else {
      if (Type.isObject(name)) {
        for (n in name) {
          l = name[n];
          this.removeListener(n, l);
        }
      } else {
        this.removeListeners(name);
      }
    }
  };

  Events.prototype.addManagedListener = function(object, name, listener) {
    if (Type.isString(listener)) {
      listener = this.bound(listener);
    }
    object.on(name, listener);
    this.managedListeners.push({
      object: object,
      name: name,
      listener: listener
    });
  };

  Events.prototype.addManagedListeners = function(object, listeners) {
    var l, n;
    for (n in listeners) {
      l = listeners[n];
      this.addManagedListener(object, n, l);
    }
  };

  Events.prototype.removeManagedListeners = function(object, name, listener) {
    var m, toRemove, _i, _j, _len, _len1, _ref;
    toRemove = [];
    _ref = this.managedListeners;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      m = _ref[_i];
      if (Type.isString(listener)) {
        listener = this.bound(listener);
      }
      if ((!object || m.object === object) && (!name || m.name === name) && (!listener || m.listener === listener)) {
        toRemove.push(m);
      }
    }
    for (_j = 0, _len1 = toRemove.length; _j < _len1; _j++) {
      m = toRemove[_j];
      m.object.un(m.name, m.listener);
      this.managedListeners.erase(m);
    }
  };

  Events.prototype.mon = function(object, name, listener) {
    if (listener) {
      this.addManagedListener(object, name, listener);
    } else {
      this.addManagedListeners(object, name);
    }
  };

  Events.prototype.mun = function(object, name, listener) {
    var l, n;
    if (Type.isObject(name)) {
      for (n in name) {
        l = name[n];
        this.removeManagedListeners(object, n, l);
      }
    } else {
      this.removeManagedListeners(object, name, listener);
    }
  };

  Events.prototype.munon = function(old, obj, name, listener) {
    if (old) {
      this.mun(old, name, listener);
    }
    if (obj) {
      this.mon(obj, name, listener);
    }
  };

  Events.prototype._destroyManagedListeners = function() {
    this.removeManagedListeners();
  };

  Events.prototype.relayEvents = function(object, events, prefix) {
    var event, listeners, _i, _len;
    listeners = {};
    prefix = prefix || '';
    for (_i = 0, _len = events.length; _i < _len; _i++) {
      event = events[_i];
      listeners[event] = this.createRelay(event, prefix);
      object.addListener(event, listeners[event]);
    }
    return {
      target: object,
      destroy: function() {
        return object.removeListeners(listeners);
      }
    };
  };

  Events.prototype.createRelay = function(event, prefix) {
    return (function(_this) {
      return function() {
        var args;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        args.unshift(prefix + event);
        return _this.emit.apply(_this, args);
      };
    })(this);
  };

  Events.prototype.addRelay = function(object, events, prefix) {
    var relay;
    relay = this.relayEvents(object, events, prefix);
    this.managedRelays.push({
      object: object,
      relay: relay
    });
  };

  Events.prototype.removeRelay = function(object) {
    var relay, toRemove, _i, _j, _len, _len1, _ref;
    toRemove = [];
    _ref = this.managedRelays;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      relay = _ref[_i];
      if (!object || relay.object === object) {
        toRemove.push(relay);
      }
    }
    for (_j = 0, _len1 = toRemove.length; _j < _len1; _j++) {
      relay = toRemove[_j];
      relay.relay.destroy();
      this.managedRelays.erase(relay);
    }
  };

  Events.prototype.relay = function(object, events, prefix) {
    this.addRelay(object, events, prefix);
  };

  Events.prototype.unrelay = function(object) {
    this.removeRelay(object);
  };

  Events.prototype._destroyManagedRelays = function() {
    this.removeRelay();
  };

  return Events;

})(NativeEvents);

module.exports = Events;


},{"events":1}],16:[function(require,module,exports){
var Events, MiwoObject,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Events = require('./Events');

MiwoObject = (function(_super) {
  __extends(MiwoObject, _super);

  MiwoObject.prototype.isObject = true;

  MiwoObject.prototype.isDestroyed = false;

  MiwoObject.prototype.destroying = false;

  function MiwoObject(config) {
    MiwoObject.__super__.constructor.call(this);
    this.setConfig(config);
    return;
  }

  MiwoObject.prototype.setConfig = function(config) {
    var k, v;
    if (!config) {
      return;
    }
    for (k in config) {
      v = config[k];
      this.setProperty(k, v);
    }
  };

  MiwoObject.prototype.setProperty = function(name, value) {
    if (value !== void 0) {
      this[name] = value;
    }
    return this;
  };

  MiwoObject.prototype.set = function(name, value) {
    this.setProperty(name, value);
    return this;
  };

  MiwoObject.prototype.destroy = function() {
    if (this.isDestroyed) {
      return;
    }
    this.destroying = true;
    this.beforeDestroy();
    this._callDestroy();
    this.doDestroy();
    this.destroying = false;
    this.isDestroyed = true;
    this.afterDestroy();
  };

  MiwoObject.prototype._callDestroy = function() {
    var method, name;
    for (name in this) {
      method = this[name];
      if (name.indexOf("_destroy") === 0) {
        method.call(this);
      }
    }
  };

  MiwoObject.prototype.toString = function() {
    return this.constructor.name;
  };

  MiwoObject.prototype.beforeDestroy = function() {
    this.beforeDestroyCalled = true;
  };

  MiwoObject.prototype.doDestroy = function() {
    this.doDestroyCalled = true;
  };

  MiwoObject.prototype.afterDestroy = function() {
    this.afterDestroyCalled = true;
  };

  return MiwoObject;

})(Events);

MiwoObject.addMethod = function(name, method) {
  this.prototype[name] = method;
};

module.exports = MiwoObject;


},{"./Events":15}],17:[function(require,module,exports){
var __slice = [].slice;

Type.extend({

  /**
  	  Returns true if the passed value is empty.
  	  The value is deemed to be empty if it is
  	  null
  	  undefined
  	  an empty array
  	  a zero length string (Unless the allowBlank parameter is true)
  	  @param {Mixed} v The value to test
  	  @param {Boolean} allowBlank (optional) true to allow empty strings (defaults to false)
  	  @return {Boolean}
   */
  isEmpty: function(v, allowBlank) {
    return v === null || v === undefined || (Type.isArray(v) && !v.length) || (!allowBlank ? v === "" : false);
  },

  /**
  	  Returns true if the passed value is a JavaScript array, otherwise false.
  	  @param {Mixed} v The value to test
  	  @return {Boolean}
   */
  isArray: function(v) {
    return Object.prototype.toString.call(v) === "[object Array]";
  },

  /**
  	  Returns true if the passed object is a JavaScript date object, otherwise false.
  	  @param {Object} v The object to test
  	  @return {Boolean}
   */
  isDate: function(v) {
    return Object.prototype.toString.call(v) === "[object Date]";
  },

  /**
  	  Returns true if the passed value is a JavaScript Object, otherwise false.
  	  @param {Mixed} v The value to test
  	  @return {Boolean}
   */
  isObject: function(v) {
    return !!v && Object.prototype.toString.call(v) === "[object Object]";
  },

  /**
  	  Returns true if the passed value is a JavaScript 'primitive', a string, number or boolean.
  	  @param {Mixed} v The value to test
  	  @return {Boolean}
   */
  isPrimitive: function(v) {
    return Type.isString(v) || Type.isNumber(v) || Type.isBoolean(v);
  },

  /**
  	  Returns true if the passed value is a number.
  	  @param {Mixed} v The value to test
  	  @return {Boolean}
   */
  isNumber: function(v) {
    return typeof v === "number";
  },

  /**
  	  Returns true if the passed value is a integer
  	  @param {Mixed} n The value to test
  	  @return {Boolean}
   */
  isInteger: function(n) {
    return Type.isNumber(n) && (n % 1 === 0);
  },

  /**
  	  Returns true if the passed value is a float
  	  @param {Mixed} n The value to test
  	  @return {Boolean}
   */
  isFloat: function(n) {
    return Type.isNumber(n) && (/\./.test(n.toString()));
  },

  /**
  	  Returns true if the passed value is a string.
  	  @param {Mixed} v The value to test
  	  @return {Boolean}
   */
  isString: function(v) {
    return typeof v === "string";
  },

  /**
  	  Returns true if the passed value is a boolean.
  	  @param {Mixed} v The value to test
  	  @return {Boolean}
   */
  isBoolean: function(v) {
    return typeof v === "boolean";
  },

  /**
  	  Returns tree if node is iterable
  	  @return {Boolean}
   */
  isIterable: function(j) {
    var i, k;
    i = typeof j;
    k = false;
    if (j && i !== "string") {
      if (i === "function") {
        k = j instanceof NodeList || j instanceof HTMLCollection;
      } else {
        k = true;
      }
    }
    if (k) {
      return j.length !== undefined;
    } else {
      return false;
    }
  },

  /**
  	  Returns true if the passed value is a function.
  	  @param {Mixed} f The value to test
  	  @return {Boolean}
   */
  isFucntion: function(f) {
    return typeof f === "function";
  },
  isInstance: function(o) {
    return this.isObject(o) && o.constructor.name !== 'Object';
  }
});

Object.expand = function() {
  var args, key, obj, original, val, _i, _len;
  original = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
  for (_i = 0, _len = args.length; _i < _len; _i++) {
    obj = args[_i];
    if (!obj) {
      continue;
    }
    for (key in obj) {
      val = obj[key];
      if (original[key] === void 0 || original[key] === null) {
        original[key] = obj[key];
      }
    }
  }
  return original;
};

Array.implement({
  insert: function(index, item) {
    this.splice(index, 0, item);
  },
  destroy: function() {
    var item, _i, _len;
    for (_i = 0, _len = this.length; _i < _len; _i++) {
      item = this[_i];
      if (item.destroy) {
        item.destroy();
      }
    }
  }
});


/**
script: array-sortby.js
version: 1.3.0
description: Array.sortBy is a prototype function to sort arrays of objects by a given key.
license: MIT-style
download: http://mootools.net/forge/p/array_sortby
source: http://github.com/eneko/Array.sortBy
 */

(function() {
  var comparer, keyPaths, saveKeyPath, valueOf;
  keyPaths = [];
  saveKeyPath = function(path) {
    keyPaths.push({
      sign: (path[0] === "+" || path[0] === "-" ? parseInt(path.shift() + 1, 0) : 1),
      path: path
    });
  };
  valueOf = function(object, path) {
    var p, ptr, _i, _len;
    ptr = object;
    for (_i = 0, _len = path.length; _i < _len; _i++) {
      p = path[_i];
      ptr = ptr[p];
    }
    return ptr;
  };
  comparer = function(a, b) {
    var aVal, bVal, item, _i, _len;
    for (_i = 0, _len = keyPaths.length; _i < _len; _i++) {
      item = keyPaths[_i];
      aVal = valueOf(a, item.path);
      bVal = valueOf(b, item.path);
      if (aVal > bVal) {
        return item.sign;
      }
      if (aVal < bVal) {
        return -item.sign;
      }
    }
  };
  Array.implement("sortBy", function() {
    var arg, args, _i, _len;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    keyPaths.empty();
    for (_i = 0, _len = args.length; _i < _len; _i++) {
      arg = args[_i];
      if (typeOf(arg) === 'array') {
        saveKeyPath(arg);
      } else {
        saveKeyPath(arg.match(/[+-]|[^.]+/g));
      }
    }
    return this.sort(comparer);
  });
})();


},{}],18:[function(require,module,exports){
module.exports = {
  Events: require('./Events'),
  Object: require('./Object')
};


},{"./Events":15,"./Object":16}],19:[function(require,module,exports){
var DiHelper;

DiHelper = (function() {
  function DiHelper() {}

  DiHelper.prototype.expandRe = /^<%([\S]+)%>$/;

  DiHelper.prototype.expandStringRe = /<%([\S]+)%>/g;

  DiHelper.prototype.serviceRe = /^@([^:]+)(:([^\(]+)(\((.*)\))?)?$/;

  DiHelper.prototype.codeRe = /^(\$)?([^\(]+)\((.*)\)$/;

  DiHelper.prototype.expand = function(param, injector) {
    var match, matches, name, value, _i, _len;
    if (Type.isString(param)) {
      if ((matches = param.match(this.expandRe))) {
        param = this.expand(this.getSection(injector.params, matches[1]), injector);
      } else if ((matches = param.match(this.expandStringRe))) {
        for (_i = 0, _len = matches.length; _i < _len; _i++) {
          match = matches[_i];
          param = param.replace(match, this.expand(match, injector));
        }
      }
    } else if (Type.isObject(param)) {
      for (name in param) {
        value = param[name];
        param[name] = this.expand(value, injector);
      }
    }
    return param;
  };

  DiHelper.prototype.evaluateCode = function(service, code, injector) {
    var arg, args, evalArgs, extraArgs, index, isProperty, matches, operation, values, _i, _len;
    if (Type.isArray(code)) {
      values = code;
      code = values.shift();
      extraArgs = this.evaluateArgs(values, injector);
    }
    if ((matches = code.match(this.codeRe))) {
      isProperty = matches[1];
      operation = matches[2];
      args = matches[3];
      evalArgs = args ? this.evaluateArgs(args, injector) : [];
      for (index = _i = 0, _len = evalArgs.length; _i < _len; index = ++_i) {
        arg = evalArgs[index];
        if (arg === '?' && extraArgs.length > 0) {
          evalArgs[index] = extraArgs.shift();
        }
      }
      if (isProperty) {
        service[operation] = evalArgs[0];
      } else {
        if (!service[operation]) {
          throw new Error("Cant call method '" + operation + "' in service '" + service.constructor.name + "'. Method is not defined");
        }
        service[operation].apply(service, evalArgs);
      }
    }
  };

  DiHelper.prototype.evaluateArgs = function(args, injector) {
    var arg, instance, matches, name, op, opArgs, opCall, result, value, _i, _len;
    result = [];
    if (Type.isString(args)) {
      args = args.split(',');
    }
    for (_i = 0, _len = args.length; _i < _len; _i++) {
      arg = args[_i];
      if (!Type.isString(arg)) {
        result.push(arg);
        continue;
      }
      value = this.expand(arg, injector);
      if (!Type.isString(value)) {
        result.push(value);
        continue;
      }
      matches = value.match(this.serviceRe);
      if (!matches) {
        result.push(value);
        continue;
      }
      name = matches[1];
      op = matches[3] || null;
      opCall = matches[4] || null;
      opArgs = matches[5] || null;
      instance = injector.get(name);
      if (!op) {
        result.push(instance);
      } else {
        if (!instance[op]) {
          throw new Error("Cant call method " + op + " in service " + name + " of " + instance.constructor.name + ". Method is not defined");
        }
        if (!opCall) {
          result.push((function(_this) {
            return function() {
              return instance[op].call(instance);
            };
          })(this));
        } else if (!args) {
          result.push(instance[op].call(instance));
        } else {
          result.push(instance[op].apply(instance, this.evaluateArgs(opArgs, injector)));
        }
      }
    }
    return result;
  };

  DiHelper.prototype.getSection = function(config, section) {
    var pos;
    pos = section.indexOf('.');
    if (pos > 0) {
      section = this.getSection(config[section.substr(0, pos)], section.substr(pos + 1));
    } else if (config && config[section] !== void 0) {
      section = config[section];
    } else {
      section = null;
    }
    return section;
  };

  return DiHelper;

})();

module.exports = new DiHelper;


},{}],20:[function(require,module,exports){
var DiHelper, Injector, Service;

Service = require('./Service');

DiHelper = require('./DiHelper');

Injector = (function() {
  Injector.prototype.params = null;

  Injector.prototype.defines = null;

  Injector.prototype.services = null;

  Injector.prototype.globals = null;

  function Injector(params) {
    this.params = params != null ? params : {};
    this.defines = {};
    this.services = {};
    this.globals = {};
    this.set('injector', this);
    if (!this.params.namespace) {
      this.params.namespace = 'App';
    }
  }

  Injector.prototype.define = function(name, klass, cb) {
    var service;
    if (cb == null) {
      cb = null;
    }
    if (this.services[name] || this.defines[name]) {
      throw new Error("Service " + name + " already exists");
    }
    service = new Service(this, name, klass, cb);
    this.defines[name] = service;
    return this.defines[name];
  };

  Injector.prototype.get = function(name) {
    if (!this.services[name] && !this.defines[name]) {
      throw new Error("Service with name " + name + " not found");
    }
    if (!this.services[name]) {
      this.services[name] = this.defines[name].create();
    }
    return this.services[name];
  };

  Injector.prototype.update = function(name) {
    if (!this.defines[name]) {
      throw new Error("Service with name " + name + " not found");
    }
    return this.defines[name];
  };

  Injector.prototype.set = function(name, service) {
    if (this.services[name] || this.defines[name]) {
      throw new Error("Service " + name + " already exists");
    }
    this.services[name] = service;
    return this;
  };

  Injector.prototype.has = function(name) {
    return this.services[name] || this.defines[name];
  };

  Injector.prototype.setGlobal = function(name, service) {
    this.globals[name] = service;
    return this;
  };

  Injector.prototype.isDefined = function(name) {
    return this.defines[name] !== void 0;
  };

  Injector.prototype.create = function(name) {
    if (!this.defines[name]) {
      throw new Error("Service with name " + name + " not defined");
    }
    return this.defines[name].create();
  };

  Injector.prototype.createInstance = function(klass, options, factory) {
    var instance, name, propName, serviceName, value, _ref;
    if (options == null) {
      options = {};
    }
    if (factory == null) {
      factory = null;
    }
    for (name in options) {
      value = options[name];
      options[name] = DiHelper.evaluateArgs(value, this)[0];
    }
    if (klass.prototype.injects) {
      _ref = klass.prototype.injects;
      for (propName in _ref) {
        serviceName = _ref[propName];
        options[propName] = this.get(serviceName);
      }
    }
    if (factory) {
      if (Type.isString(factory)) {
        factory = DiHelper.evaluateArgs(factory, this)[0];
      }
      if (Type.isFunction(factory)) {
        instance = factory(options);
      }
    } else {
      instance = new klass(options);
    }
    if (!(instance instanceof klass)) {
      throw new Error("Created service is not instance of desired type " + klass.name + ", but instance of " + instance.constructor.name);
    }
    return instance;
  };

  return Injector;

})();

module.exports = Injector;


},{"./DiHelper":19,"./Service":23}],21:[function(require,module,exports){
var DiHelper, InjectorExtension;

DiHelper = require('./DiHelper');

InjectorExtension = (function() {
  InjectorExtension.prototype.config = null;

  InjectorExtension.prototype.injector = null;

  function InjectorExtension() {
    this.config = {};
  }

  InjectorExtension.prototype.init = function() {};

  InjectorExtension.prototype.setConfig = function(config) {
    Object.merge(this.config, DiHelper.expand(config, this.injector));
  };

  return InjectorExtension;

})();

module.exports = InjectorExtension;


},{"./DiHelper":19}],22:[function(require,module,exports){
var DiHelper, Injector, InjectorFactory;

Injector = require('./Injector');

DiHelper = require('./DiHelper');

InjectorFactory = (function() {
  InjectorFactory.prototype.config = null;

  InjectorFactory.prototype.extensions = null;

  function InjectorFactory() {
    this.config = {
      params: {
        baseUrl: ''
      }
    };
    this.extensions = {};
  }

  InjectorFactory.prototype.setExtension = function(name, extension) {
    this.extensions[name] = extension;
  };

  InjectorFactory.prototype.setConfig = function(config) {
    Object.merge(this.config, config);
  };

  InjectorFactory.prototype.createInjector = function() {
    var definition, ext, extension, injector, name, service, _ref, _ref1, _ref2, _ref3, _ref4, _ref5;
    injector = new Injector(this.config.params);
    DiHelper.expand(injector.params, injector);
    _ref = this.config.extensions;
    for (name in _ref) {
      extension = _ref[name];
      this.setExtension(name, new extension());
    }
    _ref1 = this.extensions;
    for (name in _ref1) {
      ext = _ref1[name];
      ext.injector = injector;
      ext.init();
    }
    _ref2 = this.extensions;
    for (name in _ref2) {
      ext = _ref2[name];
      if (this.config[name]) {
        ext.setConfig(this.config[name], injector);
      }
    }
    _ref3 = this.extensions;
    for (name in _ref3) {
      ext = _ref3[name];
      if (ext.build) {
        ext.build(injector);
      }
    }
    if (this.config.services) {
      _ref4 = this.config.services;
      for (name in _ref4) {
        service = _ref4[name];
        if (!injector.isDefined(name)) {
          definition = injector.define(name, service.type);
        } else {
          definition = injector.update(name);
        }
        if (service.factory) {
          definition.setFactory(service.factory);
        }
        if (service.setup) {
          definition.setup(service.setup);
        }
        if (service.options) {
          definition.option(service.options);
        }
        if (service.global) {
          definition.setGlobal(name);
        }
      }
    }
    _ref5 = this.extensions;
    for (name in _ref5) {
      ext = _ref5[name];
      if (ext.update) {
        ext.update(injector);
      }
    }
    return injector;
  };

  return InjectorFactory;

})();

module.exports = InjectorFactory;


},{"./DiHelper":19,"./Injector":20}],23:[function(require,module,exports){
var DiHelper, Service;

DiHelper = require('./DiHelper');

Service = (function() {
  Service.prototype.injector = null;

  Service.prototype.name = null;

  Service.prototype.klass = null;

  Service.prototype.setups = null;

  Service.prototype.options = null;

  Service.prototype.factory = null;

  Service.prototype.global = false;

  function Service(injector, name, klass, onCreate) {
    this.injector = injector;
    this.name = name;
    this.klass = klass;
    if (onCreate == null) {
      onCreate = null;
    }
    this.setups = [];
    this.options = {};
    if (onCreate) {
      this.setups.push(onCreate);
    }
  }

  Service.prototype.create = function() {
    var instance, setup, _i, _len, _ref;
    instance = this.injector.createInstance(this.klass, this.options, this.factory);
    _ref = this.setups;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      setup = _ref[_i];
      setup(instance, this.injector);
    }
    return instance;
  };

  Service.prototype.setClass = function(klass) {
    this.klass = klass;
    return this;
  };

  Service.prototype.setFactory = function(factory) {
    this.factory = factory;
    return this;
  };

  Service.prototype.setGlobal = function(name) {
    if (name == null) {
      name = null;
    }
    this.injector.setGlobal(name || this.name, this.name);
    return this;
  };

  Service.prototype.setup = function(config) {
    if (Type.isFunction(config)) {
      this.setups.push(config);
    } else if (Type.isArray(config)) {
      this.setups.push(this.createSetup(config));
    } else {
      this.setups.push(this.createSetup(Array.from(arguments)));
    }
    return this;
  };

  Service.prototype.option = function(name, value) {
    var k, v;
    if (Type.isString(name)) {
      if (value !== void 0) {
        this.options[name] = value;
      } else {
        delete this.options[name];
      }
    } else if (Type.isObject(name)) {
      for (k in name) {
        v = name[k];
        this.option(k, v);
      }
    }
    return this;
  };

  Service.prototype.createSetup = function(config) {
    return (function(_this) {
      return function(service, injector) {
        var value, _i, _len;
        for (_i = 0, _len = config.length; _i < _len; _i++) {
          value = config[_i];
          DiHelper.evaluateCode(service, value, injector);
        }
      };
    })(this);
  };

  return Service;

})();

module.exports = Service;


},{"./DiHelper":19}],24:[function(require,module,exports){
module.exports = {
  Injector: require('./Injector'),
  InjectorFactory: require('./InjectorFactory'),
  InjectorExtension: require('./InjectorExtension')
};


},{"./Injector":20,"./InjectorExtension":21,"./InjectorFactory":22}],25:[function(require,module,exports){
var CookieManager, CookieSection;

CookieSection = require('./CookieSection');

CookieManager = (function() {
  CookieManager.prototype.document = null;

  CookieManager.prototype.options = null;

  function CookieManager(options) {
    if (options == null) {
      options = {};
    }
    this.options = options;
    this.document = document;
    return;
  }

  CookieManager.prototype.set = function(key, value, options) {
    this.create(key, options).write(value);
    return this;
  };

  CookieManager.prototype.get = function(key, def) {
    return this.create(key).read() || def;
  };

  CookieManager.prototype.remove = function(key, options) {
    this.set(key, null, Object.merge({
      duration: -1
    }, options));
    return this;
  };

  CookieManager.prototype.create = function(key, options) {
    var cookie;
    cookie = new Cookie(key, Object.merge({}, this.options, options));
    cookie.options.document = this.document;
    return cookie;
  };

  CookieManager.prototype.section = function(name, options) {
    return new CookieSection(this, name, options);
  };

  return CookieManager;

})();

module.exports = CookieManager;


},{"./CookieSection":26}],26:[function(require,module,exports){
var CookieSection;

CookieSection = (function() {
  CookieSection.prototype.cookie = null;

  CookieSection.prototype.name = null;

  CookieSection.prototype.options = null;

  CookieSection.prototype.items = null;

  function CookieSection(cookie, name, options) {
    this.cookie = cookie;
    this.name = name;
    this.options = options;
    this.items = JSON.decode(cookie.get(name) || "{}", true);
    return;
  }

  CookieSection.prototype.save = function() {
    var value;
    value = JSON.encode(this.items);
    if (!value || value.length > 4096) {
      return false;
    } else {
      if (value === "{}") {
        this.cookie.remove(this.name);
      } else {
        this.cookie.set(this.name, value, this.options);
      }
      return true;
    }
  };

  CookieSection.prototype.set = function(name, value) {
    if (value === null) {
      delete this.items[name];
    } else {
      this.items[name] = value;
    }
    return this;
  };

  CookieSection.prototype.get = function(name, def) {
    return (this.items.hasOwnProperty(name) ? this.items[name] : def);
  };

  CookieSection.prototype.has = function(name) {
    return this.items.hasOwnProperty(name);
  };

  CookieSection.prototype.each = function(callback) {
    return Object.each(this.items, callback);
  };

  return CookieSection;

})();

module.exports = CookieSection;


},{}],27:[function(require,module,exports){
var HttpRequest,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

HttpRequest = (function(_super) {
  __extends(HttpRequest, _super);

  HttpRequest.prototype.manager = null;

  function HttpRequest(options) {
    if (options == null) {
      options = {};
    }
    options.type = options.type || 'json';
    HttpRequest.__super__.constructor.call(this, Object.merge(options, {
      data: {}
    }));
    this.init();
    return;
  }

  HttpRequest.prototype.init = function() {
    if (this.options.type === 'json') {
      this.setHeader('Accept', 'application/json');
      this.setHeader('X-Request', 'JSON');
    }
  };

  HttpRequest.prototype.success = function(text) {
    var err, json;
    if (this.options.type === 'json') {
      try {
        json = JSON.decode(text, this.options.secure);
        this.response.json = json;
      } catch (_error) {
        err = _error;
        this.emit("error", err, text, this.xhr);
        this.onFailure();
        return;
      }
      this.onSuccess(json, text);
    } else {
      this.onSuccess(text);
    }
  };

  HttpRequest.prototype.send = function(options) {
    if (options == null) {
      options = {};
    }
    if (this.manager) {
      options.data = Object.merge({}, this.manager.params, options.data || this.options.data);
      HttpRequest.__super__.send.call(this, options);
    } else {
      options.data = Object.merge({}, options.data || this.options.data);
      HttpRequest.__super__.send.call(this, options);
    }
  };

  return HttpRequest;

})(Request);

module.exports = HttpRequest;


},{}],28:[function(require,module,exports){
var HttpRequest, HttpRequestManager, MiwoObject,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

MiwoObject = require('../core/Object');

HttpRequest = require('./HttpRequest');

HttpRequestManager = (function(_super) {
  __extends(HttpRequestManager, _super);

  HttpRequestManager.prototype.params = null;

  HttpRequestManager.prototype.plugins = null;

  function HttpRequestManager() {
    HttpRequestManager.__super__.constructor.call(this);
    this.params = {};
    this.plugins = [];
    this.on('request', (function(_this) {
      return function(req) {
        var plugin, _i, _len, _ref;
        _ref = _this.plugins;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          plugin = _ref[_i];
          if (plugin.request) {
            plugin.request(req);
          }
        }
      };
    })(this));
    this.on('success', (function(_this) {
      return function(req, payload) {
        var plugin, _i, _len, _ref;
        _ref = _this.plugins;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          plugin = _ref[_i];
          if (plugin.success) {
            plugin.success(req, payload);
          }
        }
      };
    })(this));
    this.on('failure', (function(_this) {
      return function(req) {
        var plugin, _i, _len, _ref;
        _ref = _this.plugins;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          plugin = _ref[_i];
          if (plugin.failure) {
            plugin.failure(req);
          }
        }
      };
    })(this));
    this.on('error', (function(_this) {
      return function(req) {
        var plugin, _i, _len, _ref;
        _ref = _this.plugins;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          plugin = _ref[_i];
          if (plugin.error) {
            plugin.error(req);
          }
        }
      };
    })(this));
    return;
  }


  /*
  		Register plugin
  		@param plugin {Object} plugin
   */

  HttpRequestManager.prototype.plugin = function(plugin) {
    this.plugins.push(plugin);
  };


  /*
  		Create managed request
  		@param options {Object}
  		@return {Miwo.http.HttpRequest}
   */

  HttpRequestManager.prototype.createRequest = function(options) {
    var request;
    request = new HttpRequest(options);
    this.manage(request);
    return request;
  };

  HttpRequestManager.prototype.get = function(options) {
    var request;
    request = this.createRequest(options);
    request.get();
    return request;
  };

  HttpRequestManager.prototype.post = function(options) {
    var request;
    request = this.createRequest(options);
    request.post();
    return request;
  };

  HttpRequestManager.prototype.read = function(url) {
    var data, request;
    data = null;
    request = new Request({
      url: url,
      async: false,
      onSuccess: function(response) {
        return data = response;
      },
      onFailure: function(xhr) {
        return data = null;
      }
    });
    request.send();
    return data;
  };

  HttpRequestManager.prototype.manage = function(req) {
    if (!req.manager) {
      req.manager = this;
      req.on("request", (function(_this) {
        return function() {
          return _this.emit("request", req);
        };
      })(this));
      req.on("success", (function(_this) {
        return function(payload) {
          return _this.emit("success", req, payload);
        };
      })(this));
      req.on("failure", (function(_this) {
        return function() {
          return _this.emit("failure", req);
        };
      })(this));
      req.on("error", (function(_this) {
        return function(err) {
          return _this.emit("error", req, err);
        };
      })(this));
    }
  };

  return HttpRequestManager;

})(MiwoObject);

module.exports = HttpRequestManager;


},{"../core/Object":16,"./HttpRequest":27}],29:[function(require,module,exports){
module.exports = {
  HttpRequest: require('./HttpRequest'),
  HttpRequestManager: require('./HttpRequestManager'),
  CookieSection: require('./CookieSection'),
  CookieManager: require('./CookieManager'),
  plugins: require('./plugins')
};


},{"./CookieManager":25,"./CookieSection":26,"./HttpRequest":27,"./HttpRequestManager":28,"./plugins":30}],30:[function(require,module,exports){
var ErrorPlugin, FailurePlugin, RedirectPlugin;

RedirectPlugin = (function() {
  function RedirectPlugin() {}

  RedirectPlugin.prototype.success = function(request, payload) {
    if (request.type !== 'json') {
      return;
    }
    if (payload.redirect) {
      document.location = payload.redirect;
    }
  };

  return RedirectPlugin;

})();

FailurePlugin = (function() {
  function FailurePlugin() {}

  FailurePlugin.prototype.failure = function(request) {
    miwo.flash.error(request.xhr.statusText + ": " + request.xhr.responseText.replace(/(<([^>]+)>)/g, ""));
  };

  return FailurePlugin;

})();

ErrorPlugin = (function() {
  function ErrorPlugin() {}

  ErrorPlugin.prototype.error = function(request, err) {
    console.log("Error in ajax request", request, err);
  };

  return ErrorPlugin;

})();

module.exports = {
  RedirectPlugin: RedirectPlugin,
  FailurePlugin: FailurePlugin,
  ErrorPlugin: ErrorPlugin
};


},{}],31:[function(require,module,exports){
(function (global){
var Miwo, miwo;

require('./core/Common');

require('./core/Types');

require('./core/Element');

miwo = require('./bootstrap/Miwo');

global.miwo = miwo;

Miwo = {};

global.Miwo = Miwo;

miwo.registerExtension('miwo', require('./DiExtension'));

Miwo.core = require('./core');

Miwo.Object = Miwo.core.Object;

Miwo.Events = Miwo.core.Events;

Miwo.component = require('./component');

Miwo.Component = Miwo.component.Component;

Miwo.Container = Miwo.component.Container;

Miwo.di = require('./di');

Miwo.http = require('./http');

Miwo.locale = require('./locale');

Miwo.utils = require('./utils');


}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./DiExtension":2,"./bootstrap/Miwo":4,"./component":12,"./core":18,"./core/Common":13,"./core/Element":14,"./core/Types":17,"./di":24,"./http":29,"./locale":39,"./utils":44}],32:[function(require,module,exports){
var AbsoluteLayout, Layout,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Layout = require('./Layout');

AbsoluteLayout = (function(_super) {
  __extends(AbsoluteLayout, _super);

  function AbsoluteLayout(config) {
    AbsoluteLayout.__super__.constructor.call(this, config);
    this.type = 'absolute';
    this.targetCls = 'miwo-layout-absolute';
    this.itemCls = 'miwo-layout-item';
    return;
  }

  AbsoluteLayout.prototype.configureComponent = function(component) {
    AbsoluteLayout.__super__.configureComponent.call(this, component);
    component.el.setStyles({
      top: component.top,
      bottom: component.bottom,
      left: component.left,
      right: component.right
    });
  };

  AbsoluteLayout.prototype.unconfigureComponent = function(component) {
    AbsoluteLayout.__super__.unconfigureComponent.call(this, component);
    component.el.setStyles({
      top: null,
      bottom: null,
      left: null,
      right: null
    });
  };

  return AbsoluteLayout;

})(Layout);

module.exports = AbsoluteLayout;


},{"./Layout":36}],33:[function(require,module,exports){
var AutoLayout, Layout,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Layout = require('./Layout');

AutoLayout = (function(_super) {
  __extends(AutoLayout, _super);

  function AutoLayout(config) {
    AutoLayout.__super__.constructor.call(this, config);
    this.type = 'auto';
    this.targetCls = '';
    this.itemCls = '';
  }

  return AutoLayout;

})(Layout);

module.exports = AutoLayout;


},{"./Layout":36}],34:[function(require,module,exports){
var FitLayout, Layout,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Layout = require('./Layout');

FitLayout = (function(_super) {
  __extends(FitLayout, _super);

  function FitLayout(config) {
    FitLayout.__super__.constructor.call(this, config);
    this.type = 'fit';
    this.targetCls = 'miwo-layout-fit';
    this.itemCls = 'miwo-layout-item';
  }

  return FitLayout;

})(Layout);

module.exports = FitLayout;


},{"./Layout":36}],35:[function(require,module,exports){
var FormLayout, Layout,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Layout = require('./Layout');

FormLayout = (function(_super) {
  __extends(FormLayout, _super);

  function FormLayout(config) {
    FormLayout.__super__.constructor.call(this, config);
    this.type = 'form';
    this.targetCls = 'miwo-layout-form';
    this.itemCls = '';
  }

  return FormLayout;

})(Layout);

module.exports = FormLayout;


},{"./Layout":36}],36:[function(require,module,exports){
var Laoyut, MiwoObject,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

MiwoObject = require('../core/Object');

Laoyut = (function(_super) {
  __extends(Laoyut, _super);

  function Laoyut() {
    return Laoyut.__super__.constructor.apply(this, arguments);
  }

  Laoyut.prototype.isLayout = true;

  Laoyut.prototype.targetCls = "miwo-layout";

  Laoyut.prototype.itemCls = "miwo-layout-item";

  Laoyut.prototype.container = null;

  Laoyut.prototype.initialized = false;

  Laoyut.prototype.running = false;

  Laoyut.prototype.ownerLayout = null;

  Laoyut.prototype.enabled = true;

  Laoyut.prototype.setContainer = function(container) {
    this.munon(this.container, container, 'added', this.bound("onAdded"));
    this.munon(this.container, container, 'removed', this.bound("onRemoved"));
    this.container = container;
  };

  Laoyut.prototype.getLayoutComponents = function() {
    return this.container.getComponents();
  };

  Laoyut.prototype.getRenderTarget = function() {
    return this.container.getContentEl();
  };

  Laoyut.prototype.initLayout = function() {
    this.initialized = true;
  };

  Laoyut.prototype.setOwnerLayout = function(layout) {
    this.ownerLayout = layout;
  };

  Laoyut.prototype.render = function() {
    if (this.targetCls) {
      this.getRenderTarget().addClass(this.targetCls);
    }
    this.update();
  };

  Laoyut.prototype.update = function() {
    this.renderComponents(this.getLayoutComponents(), this.getRenderTarget());
  };

  Laoyut.prototype.onAdded = function(container, component, position) {
    if (container.rendered) {
      this.renderComponent(component, this.getRenderTarget(), position);
    }
  };

  Laoyut.prototype.onRemoved = function(container, component) {
    if (container.rendered) {
      this.removeComponent(component);
    }
  };

  Laoyut.prototype.renderComponents = function(components, target) {
    if (!this.enabled) {
      return;
    }
    components.each((function(_this) {
      return function(component, index) {
        if (!component.rendered) {
          return _this.renderComponent(component, target, index);
        } else {
          return _this.updateComponent(component);
        }
      };
    })(this));
  };

  Laoyut.prototype.renderComponent = function(component, target, position) {
    if (!this.enabled) {
      return;
    }
    if (!component.rendered && !component.preventAutoRender) {
      this.configureComponent(component);
      component.render(target);
      this.afterRenderComponent(component);
    }
  };

  Laoyut.prototype.updateComponent = function(component) {
    this.configureComponent(component);
    component.update();
  };

  Laoyut.prototype.configureComponent = function(component) {
    if (component.isContainer && component.hasLayout()) {
      component.getLayout().setOwnerLayout(this);
    }
    if (this.itemCls) {
      component.el.addClass(this.itemCls);
    }
    if (component.width || component.width === null) {
      component.el.setStyle('width', component.width);
    }
    if (component.height || component.height === null) {
      component.el.setStyle('height', component.height);
    }
  };

  Laoyut.prototype.afterRenderComponent = function(component) {};

  Laoyut.prototype.removeComponent = function(component) {
    if (component.rendered) {
      this.unconfigureComponent(component);
      component.el.dispose();
      this.afterRemoveComponent(component);
    }
  };

  Laoyut.prototype.unconfigureComponent = function(component) {
    if (component.isContainer && component.hasLayout()) {
      component.getLayout().setOwnerLayout(null);
    }
    if (this.itemCls) {
      component.el.removeClass(this.itemCls);
    }
    if (component.width) {
      component.el.setStyle('width', null);
    }
    if (component.height) {
      component.el.setStyle('height', null);
    }
  };

  Laoyut.prototype.afterRemoveComponent = function(component) {};

  Laoyut.prototype.doDestroy = function() {
    if (this.targetCls) {
      this.getRenderTarget().removeClass(this.targetCls);
    }
    this.setContainer(null);
    Laoyut.__super__.doDestroy.call(this);
  };

  return Laoyut;

})(MiwoObject);

module.exports = Laoyut;


},{"../core/Object":16}],37:[function(require,module,exports){
module.exports = {
  Absolute: require('./Absolute'),
  Form: require('./Form'),
  Fit: require('./Fit'),
  Auto: require('./Auto'),
  Layout: require('./Layout'),
  createLayout: function(type) {
    return new this[type.capitalize()]();
  }
};


},{"./Absolute":32,"./Auto":33,"./Fit":34,"./Form":35,"./Layout":36}],38:[function(require,module,exports){
var Translator;

Translator = (function() {
  Translator.prototype.translates = null;

  Translator.prototype.lang = null;

  Translator.prototype.defaultLang = null;

  function Translator() {
    this.translates = {};
    return;
  }

  Translator.prototype.setDefault = function(defaultLang) {
    this.defaultLang = defaultLang;
  };

  Translator.prototype.setTranslates = function(lang, name, translates) {
    if (!this.defaultLang) {
      this.defaultLang = lang;
      this.lang = lang;
    }
    if (!this.translates[lang]) {
      this.translates[lang] = {};
    }
    if (!this.translates[lang][name]) {
      this.translates[lang][name] = translates;
    } else {
      Object.merge(this.translates[lang][name], translates);
    }
  };

  Translator.prototype.use = function(lang) {
    this.lang = lang;
  };

  Translator.prototype.get = function(key) {
    var translated;
    translated = this.getByLang(key, this.lang);
    if (translated === null) {
      translated = this.getByLang(key, this.defaultLang);
    }
    if (translated === null) {
      translated = '';
    }
    return translated;
  };

  Translator.prototype.getByLang = function(key, lang) {
    var group, part, _i, _len, _ref;
    group = this.translates[lang];
    if (!group) {
      return null;
    }
    _ref = key.split('.');
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      part = _ref[_i];
      group = group[part];
      if (group === void 0) {
        return null;
      }
      if (!group) {
        break;
      }
    }
    return group;
  };

  return Translator;

})();

module.exports = Translator;


},{}],39:[function(require,module,exports){
module.exports = {
  Translator: require('./Translator')
};


},{"./Translator":38}],40:[function(require,module,exports){
var Collection;

Collection = (function() {
  function Collection(object) {
    var key;
    if (object == null) {
      object = null;
    }
    this.items = {};
    this.length = 0;
    if (object) {
      if (object instanceof Collection) {
        for (key in object.items) {
          this.items[key] = object.items[key];
        }
      } else {
        for (key in object) {
          this.items[key] = object[key];
        }
      }
    }
  }

  Collection.prototype.each = function(cb) {
    Object.each(this.items, cb);
  };

  Collection.prototype.filter = function(cb) {
    return Object.filter(this.items, cb);
  };

  Collection.prototype.find = function(cb) {
    return Object.some(this.items, cb);
  };

  Collection.prototype.set = function(name, value) {
    if (!this.has(name)) {
      this.length++;
    }
    this.items[name] = value;
  };

  Collection.prototype.get = function(name, def) {
    if (def == null) {
      def = null;
    }
    if (this.has(name)) {
      return this.items[name];
    } else {
      return def;
    }
  };

  Collection.prototype.getBy = function(name, value) {
    var item, _i, _len, _ref;
    _ref = this.items;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      item = _ref[_i];
      if (item[name] === value) {
        return item;
      }
    }
    return null;
  };

  Collection.prototype.has = function(name) {
    return this.items[name] !== void 0;
  };

  Collection.prototype.remove = function(name) {
    if (this.items[name]) {
      delete this.items[name];
      this.length--;
    }
  };

  Collection.prototype.empty = function() {
    this.items = {};
    this.length = 0;
  };

  Collection.prototype.getFirst = function() {
    var item, key, _ref;
    _ref = this.items;
    for (key in _ref) {
      item = _ref[key];
      return item;
    }
    return null;
  };

  Collection.prototype.getLast = function() {
    var item, key, last, _ref;
    last = null;
    _ref = this.items;
    for (key in _ref) {
      item = _ref[key];
      last = item;
      continue;
    }
    return last;
  };

  Collection.prototype.keyOf = function(value) {
    return Object.keyOf(this.items, value);
  };

  Collection.prototype.indexOf = function(find) {
    var index, item, key, _ref;
    index = 0;
    _ref = this.items;
    for (key in _ref) {
      item = _ref[key];
      if (item === find) {
        return index;
      }
      index++;
    }
    return -1;
  };

  Collection.prototype.getAt = function(at) {
    var index, item, key, _ref;
    index = 0;
    _ref = this.items;
    for (key in _ref) {
      item = _ref[key];
      if (index === at) {
        return item;
      }
      index++;
    }
    return null;
  };

  Collection.prototype.getKeys = function() {
    return Object.keys(this.items);
  };

  Collection.prototype.getValues = function() {
    return Object.values(this.items);
  };

  Collection.prototype.toArray = function() {
    var array, item, key, _ref;
    array = [];
    _ref = this.items;
    for (key in _ref) {
      item = _ref[key];
      array.push(item);
    }
    return array;
  };

  Collection.prototype.destroy = function() {
    var item, key, _ref;
    _ref = this.items;
    for (key in _ref) {
      item = _ref[key];
      if (item.destroy) {
        item.destroy();
      }
      delete this.items[key];
    }
  };

  return Collection;

})();

module.exports = Collection;


},{}],41:[function(require,module,exports){
var DefaultFlashRender, FlashNotificator;

DefaultFlashRender = (function() {
  function DefaultFlashRender() {}

  DefaultFlashRender.prototype.show = function(message, type) {
    if (!console) {
      return;
    }
    if (type === 'error') {
      console.error(message);
    } else {
      console.log('FLASH:', message, type);
    }
  };

  return DefaultFlashRender;

})();

FlashNotificator = (function() {
  FlashNotificator.prototype.renderer = null;

  function FlashNotificator() {
    this.renderer = new DefaultFlashRender();
    return;
  }

  FlashNotificator.prototype.success = function(message) {
    this.message(message, 'success');
  };

  FlashNotificator.prototype.error = function(message) {
    this.message(message, 'error');
  };

  FlashNotificator.prototype.info = function(message) {
    this.message(message, 'info');
  };

  FlashNotificator.prototype.warning = function(message) {
    this.message(message, 'warning');
  };

  FlashNotificator.prototype.message = function(message, type) {
    if (this.renderer) {
      this.renderer.show(message, type);
    }
  };

  return FlashNotificator;

})();

module.exports = FlashNotificator;


},{}],42:[function(require,module,exports){
var KeyListener;

KeyListener = (function() {
  KeyListener.prototype.target = null;

  KeyListener.prototype.event = 'keyup';

  KeyListener.prototype.handlers = null;

  KeyListener.prototype.handleEvent = null;

  KeyListener.prototype.paused = true;

  function KeyListener(target, event) {
    this.target = target;
    if (event) {
      this.event = event;
    }
    this.handlers = {};
    this.handleEvent = (function(_this) {
      return function(e) {
        var stopEvent;
        if (_this.handlers[e.key]) {
          stopEvent = _this.handlers[e.key](e);
          if (stopEvent) {
            e.stop();
          }
        }
      };
    })(this);
    this.resume();
    return;
  }

  KeyListener.prototype.on = function(name, handler) {
    this.handlers[name] = handler;
  };

  KeyListener.prototype.resume = function() {
    if (!this.paused) {
      return;
    }
    this.paused = false;
    this.target.on(this.event, this.handleEvent);
  };

  KeyListener.prototype.pause = function() {
    if (this.paused) {
      return;
    }
    this.paused = true;
    this.target.un(this.event, this.handleEvent);
  };

  KeyListener.prototype.destroy = function() {
    this.pause();
  };

  return KeyListener;

})();

module.exports = KeyListener;


},{}],43:[function(require,module,exports){
var MiwoObject, Overlay,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

MiwoObject = require('../core/Object');

Overlay = (function(_super) {
  __extends(Overlay, _super);

  Overlay.prototype.color = "#000";

  Overlay.prototype.opacity = 0.5;

  Overlay.prototype.zIndex = 5000;

  Overlay.prototype.target = null;

  Overlay.prototype.overlay = null;

  function Overlay(target, config) {
    this.target = target;
    Overlay.__super__.constructor.call(this, config);
    this.overlay = new Element("div", {
      parent: this.target,
      cls: "miwo-overlay",
      styles: {
        position: "absolute",
        background: this.color,
        "z-index": this.zIndex
      }
    });
    this.overlay.on('click', (function(_this) {
      return function() {
        return _this.emit('click');
      };
    })(this));
    return;
  }

  Overlay.prototype.setZIndex = function(zIndex) {
    this.overlay.setStyle("z-index", zIndex);
  };

  Overlay.prototype.open = function() {
    this.opened = true;
    this.emit("open");
    this.target.addClass("miwo-overlayed");
    this.overlay.setStyle("display", "block");
    ((function(_this) {
      return function() {
        return _this.overlay.setStyle("opacity", _this.opacity);
      };
    })(this)).delay(1);
    this.emit("show");
  };

  Overlay.prototype.close = function() {
    this.opened = false;
    this.emit("close");
    this.target.removeClass("miwo-overlayed");
    this.overlay.setStyle("opacity", 0.0);
    ((function(_this) {
      return function() {
        if (!_this.opened) {
          return _this.overlay.setStyle("display", "none");
        }
      };
    })(this)).delay(300);
    this.emit("hide");
  };

  Overlay.prototype.doDestroy = function() {
    this.overlay.destroy();
    return Overlay.__super__.doDestroy.apply(this, arguments);
  };

  return Overlay;

})(MiwoObject);

module.exports = Overlay;


},{"../core/Object":16}],44:[function(require,module,exports){
module.exports = {
  Overlay: require('./Overlay'),
  Collection: require('./Collection'),
  KeyListener: require('./KeyListener'),
  FlashNotificator: require('./FlashNotificator')
};


},{"./Collection":40,"./FlashNotificator":41,"./KeyListener":42,"./Overlay":43}]},{},[31])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi91c3IvbG9jYWwvbGliL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi91c3IvbG9jYWwvbGliL25vZGVfbW9kdWxlcy9ndWxwLWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2V2ZW50cy9ldmVudHMuanMiLCIvd3d3L3Zob3N0cy9taXdvanMvbWl3by9zcmMvRGlFeHRlbnNpb24uY29mZmVlIiwiL3d3dy92aG9zdHMvbWl3b2pzL21pd28vc3JjL2Jvb3RzdHJhcC9Db25maWd1cmF0b3IuY29mZmVlIiwiL3d3dy92aG9zdHMvbWl3b2pzL21pd28vc3JjL2Jvb3RzdHJhcC9NaXdvLmNvZmZlZSIsIi93d3cvdmhvc3RzL21pd29qcy9taXdvL3NyYy9jb21wb25lbnQvQ29tcG9uZW50LmNvZmZlZSIsIi93d3cvdmhvc3RzL21pd29qcy9taXdvL3NyYy9jb21wb25lbnQvQ29tcG9uZW50TWFuYWdlci5jb2ZmZWUiLCIvd3d3L3Zob3N0cy9taXdvanMvbWl3by9zcmMvY29tcG9uZW50L0NvbXBvbmVudFNlbGVjdG9yLmNvZmZlZSIsIi93d3cvdmhvc3RzL21pd29qcy9taXdvL3NyYy9jb21wb25lbnQvQ29udGFpbmVyLmNvZmZlZSIsIi93d3cvdmhvc3RzL21pd29qcy9taXdvL3NyYy9jb21wb25lbnQvU3RhdGVNYW5hZ2VyLmNvZmZlZSIsIi93d3cvdmhvc3RzL21pd29qcy9taXdvL3NyYy9jb21wb25lbnQvU3RhdGVQZXJzaXN0ZXIuY29mZmVlIiwiL3d3dy92aG9zdHMvbWl3b2pzL21pd28vc3JjL2NvbXBvbmVudC9aSW5kZXhNYW5hZ2VyLmNvZmZlZSIsIi93d3cvdmhvc3RzL21pd29qcy9taXdvL3NyYy9jb21wb25lbnQvaW5kZXguY29mZmVlIiwiL3d3dy92aG9zdHMvbWl3b2pzL21pd28vc3JjL2NvcmUvQ29tbW9uLmNvZmZlZSIsIi93d3cvdmhvc3RzL21pd29qcy9taXdvL3NyYy9jb3JlL0VsZW1lbnQuY29mZmVlIiwiL3d3dy92aG9zdHMvbWl3b2pzL21pd28vc3JjL2NvcmUvRXZlbnRzLmNvZmZlZSIsIi93d3cvdmhvc3RzL21pd29qcy9taXdvL3NyYy9jb3JlL09iamVjdC5jb2ZmZWUiLCIvd3d3L3Zob3N0cy9taXdvanMvbWl3by9zcmMvY29yZS9UeXBlcy5jb2ZmZWUiLCIvd3d3L3Zob3N0cy9taXdvanMvbWl3by9zcmMvY29yZS9pbmRleC5jb2ZmZWUiLCIvd3d3L3Zob3N0cy9taXdvanMvbWl3by9zcmMvZGkvRGlIZWxwZXIuY29mZmVlIiwiL3d3dy92aG9zdHMvbWl3b2pzL21pd28vc3JjL2RpL0luamVjdG9yLmNvZmZlZSIsIi93d3cvdmhvc3RzL21pd29qcy9taXdvL3NyYy9kaS9JbmplY3RvckV4dGVuc2lvbi5jb2ZmZWUiLCIvd3d3L3Zob3N0cy9taXdvanMvbWl3by9zcmMvZGkvSW5qZWN0b3JGYWN0b3J5LmNvZmZlZSIsIi93d3cvdmhvc3RzL21pd29qcy9taXdvL3NyYy9kaS9TZXJ2aWNlLmNvZmZlZSIsIi93d3cvdmhvc3RzL21pd29qcy9taXdvL3NyYy9kaS9pbmRleC5jb2ZmZWUiLCIvd3d3L3Zob3N0cy9taXdvanMvbWl3by9zcmMvaHR0cC9Db29raWVNYW5hZ2VyLmNvZmZlZSIsIi93d3cvdmhvc3RzL21pd29qcy9taXdvL3NyYy9odHRwL0Nvb2tpZVNlY3Rpb24uY29mZmVlIiwiL3d3dy92aG9zdHMvbWl3b2pzL21pd28vc3JjL2h0dHAvSHR0cFJlcXVlc3QuY29mZmVlIiwiL3d3dy92aG9zdHMvbWl3b2pzL21pd28vc3JjL2h0dHAvSHR0cFJlcXVlc3RNYW5hZ2VyLmNvZmZlZSIsIi93d3cvdmhvc3RzL21pd29qcy9taXdvL3NyYy9odHRwL2luZGV4LmNvZmZlZSIsIi93d3cvdmhvc3RzL21pd29qcy9taXdvL3NyYy9odHRwL3BsdWdpbnMuY29mZmVlIiwiL3d3dy92aG9zdHMvbWl3b2pzL21pd28vc3JjL2luZGV4LmNvZmZlZSIsIi93d3cvdmhvc3RzL21pd29qcy9taXdvL3NyYy9sYXlvdXQvQWJzb2x1dGUuY29mZmVlIiwiL3d3dy92aG9zdHMvbWl3b2pzL21pd28vc3JjL2xheW91dC9BdXRvLmNvZmZlZSIsIi93d3cvdmhvc3RzL21pd29qcy9taXdvL3NyYy9sYXlvdXQvRml0LmNvZmZlZSIsIi93d3cvdmhvc3RzL21pd29qcy9taXdvL3NyYy9sYXlvdXQvRm9ybS5jb2ZmZWUiLCIvd3d3L3Zob3N0cy9taXdvanMvbWl3by9zcmMvbGF5b3V0L0xheW91dC5jb2ZmZWUiLCIvd3d3L3Zob3N0cy9taXdvanMvbWl3by9zcmMvbGF5b3V0L2luZGV4LmNvZmZlZSIsIi93d3cvdmhvc3RzL21pd29qcy9taXdvL3NyYy9sb2NhbGUvVHJhbnNsYXRvci5jb2ZmZWUiLCIvd3d3L3Zob3N0cy9taXdvanMvbWl3by9zcmMvbG9jYWxlL2luZGV4LmNvZmZlZSIsIi93d3cvdmhvc3RzL21pd29qcy9taXdvL3NyYy91dGlscy9Db2xsZWN0aW9uLmNvZmZlZSIsIi93d3cvdmhvc3RzL21pd29qcy9taXdvL3NyYy91dGlscy9GbGFzaE5vdGlmaWNhdG9yLmNvZmZlZSIsIi93d3cvdmhvc3RzL21pd29qcy9taXdvL3NyYy91dGlscy9LZXlMaXN0ZW5lci5jb2ZmZWUiLCIvd3d3L3Zob3N0cy9taXdvanMvbWl3by9zcmMvdXRpbHMvT3ZlcmxheS5jb2ZmZWUiLCIvd3d3L3Zob3N0cy9taXdvanMvbWl3by9zcmMvdXRpbHMvaW5kZXguY29mZmVlIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3U0EsSUFBQSx5Q0FBQTtFQUFBO2lTQUFBOztBQUFBLEVBQUEsR0FBSyxPQUFBLENBQVEsTUFBUixDQUFMLENBQUE7O0FBQUEsSUFDQSxHQUFPLE9BQUEsQ0FBUSxRQUFSLENBRFAsQ0FBQTs7QUFBQSxTQUVBLEdBQVksT0FBQSxDQUFRLGFBQVIsQ0FGWixDQUFBOztBQUFBLEtBR0EsR0FBUSxPQUFBLENBQVEsU0FBUixDQUhSLENBQUE7O0FBQUE7QUFTQyxrQ0FBQSxDQUFBOzs7O0dBQUE7O0FBQUEsMEJBQUEsSUFBQSxHQUFNLFNBQUEsR0FBQTtBQUNMLElBQUEsSUFBQyxDQUFBLFNBQUQsQ0FDQztBQUFBLE1BQUEsSUFBQSxFQUNDO0FBQUEsUUFBQSxNQUFBLEVBQVEsRUFBUjtBQUFBLFFBQ0EsT0FBQSxFQUNDO0FBQUEsVUFBQSxRQUFBLEVBQVUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUF2QjtBQUFBLFVBQ0EsT0FBQSxFQUFTLElBQUksQ0FBQyxPQUFPLENBQUMsYUFEdEI7QUFBQSxVQUVBLEtBQUEsRUFBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBRnBCO1NBRkQ7T0FERDtBQUFBLE1BTUEsTUFBQSxFQUNDO0FBQUEsUUFBQSxRQUFBLEVBQVUsSUFBVjtPQVBEO0FBQUEsTUFRQSxFQUFBLEVBQ0M7QUFBQSxRQUFBLFFBQUEsRUFBVSxFQUFWO09BVEQ7QUFBQSxNQVVBLEtBQUEsRUFDQztBQUFBLFFBQUEsUUFBQSxFQUFVLElBQVY7T0FYRDtLQURELENBQUEsQ0FESztFQUFBLENBQU4sQ0FBQTs7QUFBQSwwQkFpQkEsS0FBQSxHQUFPLFNBQUMsUUFBRCxHQUFBO0FBQ04sUUFBQSxzQ0FBQTtBQUFBLElBQUEsTUFBQSxHQUFTLElBQUMsQ0FBQSxNQUFWLENBQUE7QUFBQSxJQUNBLFNBQUEsR0FBWSxNQUFPLENBQUEsUUFBUSxDQUFDLE1BQU0sQ0FBQyxTQUFoQixDQURuQixDQUFBO0FBRUEsSUFBQSxJQUFHLENBQUEsU0FBSDtBQUNDLE1BQUEsU0FBQSxHQUFZLEVBQVosQ0FBQTtBQUFBLE1BQ0EsTUFBTyxDQUFBLFFBQVEsQ0FBQyxNQUFNLENBQUMsU0FBaEIsQ0FBUCxHQUFvQyxTQURwQyxDQUREO0tBRkE7QUFNQSxJQUFBLElBQUcsQ0FBQSxTQUFVLENBQUMsVUFBZDtBQUE4QixNQUFBLFNBQVMsQ0FBQyxVQUFWLEdBQXVCLEVBQXZCLENBQTlCO0tBTkE7QUFPQSxJQUFBLElBQUcsQ0FBQSxTQUFVLENBQUMsV0FBZDtBQUErQixNQUFBLFNBQVMsQ0FBQyxXQUFWLEdBQXdCLEVBQXhCLENBQS9CO0tBUEE7QUFXQTtBQUFBLFNBQUEsWUFBQTsyQkFBQTtBQUNDLE1BQUEsUUFBUSxDQUFDLFNBQVQsQ0FBbUIsSUFBbkIsRUFBd0IsT0FBeEIsQ0FBQSxDQUREO0FBQUEsS0FYQTtBQUFBLElBZ0JBLFFBQVEsQ0FBQyxNQUFULENBQWdCLE1BQWhCLEVBQXdCLElBQUksQ0FBQyxrQkFBN0IsRUFBaUQsU0FBQyxPQUFELEdBQUE7QUFDaEQsVUFBQSxhQUFBO0FBQUEsTUFBQSxPQUFPLENBQUMsTUFBUixHQUFpQixNQUFNLENBQUMsSUFBSSxDQUFDLE1BQTdCLENBQUE7QUFDQTtBQUFBLFdBQUEsYUFBQTs2QkFBQTtBQUNDLFFBQUEsSUFBZ0MsTUFBaEM7QUFBQSxVQUFBLE9BQU8sQ0FBQyxNQUFSLENBQW1CLElBQUEsTUFBQSxDQUFBLENBQW5CLENBQUEsQ0FBQTtTQUREO0FBQUEsT0FGZ0Q7SUFBQSxDQUFqRCxDQWhCQSxDQUFBO0FBQUEsSUFzQkEsUUFBUSxDQUFDLE1BQVQsQ0FBZ0IsUUFBaEIsRUFBMEIsSUFBSSxDQUFDLGFBQS9CLEVBQThDLFNBQUMsT0FBRCxHQUFBO0FBQzdDLE1BQUEsSUFBRyxNQUFNLENBQUMsTUFBTSxDQUFDLFFBQWpCO0FBQ0MsUUFBQSxPQUFPLENBQUMsUUFBUixHQUFtQixNQUFNLENBQUMsTUFBTSxDQUFDLFFBQWpDLENBREQ7T0FENkM7SUFBQSxDQUE5QyxDQXRCQSxDQUFBO0FBQUEsSUE2QkEsUUFBUSxDQUFDLE1BQVQsQ0FBZ0IsY0FBaEIsRUFBZ0MsU0FBUyxDQUFDLGdCQUExQyxDQTdCQSxDQUFBO0FBQUEsSUErQkEsUUFBUSxDQUFDLE1BQVQsQ0FBZ0IsbUJBQWhCLEVBQXFDLFNBQVMsQ0FBQyxZQUEvQyxDQS9CQSxDQUFBO0FBQUEsSUFpQ0EsUUFBUSxDQUFDLE1BQVQsQ0FBZ0IseUJBQWhCLEVBQTJDLFNBQVMsQ0FBQyxjQUFyRCxDQWpDQSxDQUFBO0FBQUEsSUFtQ0EsUUFBUSxDQUFDLE1BQVQsQ0FBZ0IsbUJBQWhCLEVBQXFDLFNBQVMsQ0FBQyxpQkFBL0MsQ0FuQ0EsQ0FBQTtBQUFBLElBcUNBLFFBQVEsQ0FBQyxNQUFULENBQWdCLFdBQWhCLEVBQTZCLFNBQVMsQ0FBQyxhQUF2QyxDQXJDQSxDQUFBO0FBQUEsSUF5Q0EsUUFBUSxDQUFDLE1BQVQsQ0FBZ0IsT0FBaEIsRUFBeUIsS0FBSyxDQUFDLGdCQUEvQixFQUFpRCxTQUFDLE9BQUQsR0FBQTtBQUNoRCxNQUFBLElBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFoQjtBQUNDLFFBQUEsT0FBTyxDQUFDLFFBQVIsR0FBbUIsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFoQyxDQUREO09BRGdEO0lBQUEsQ0FBakQsQ0F6Q0EsQ0FETTtFQUFBLENBakJQLENBQUE7O3VCQUFBOztHQUgyQixFQUFFLENBQUMsa0JBTi9CLENBQUE7O0FBQUEsTUE0RU0sQ0FBQyxPQUFQLEdBQWlCLGFBNUVqQixDQUFBOzs7O0FDQUEsSUFBQSw2QkFBQTs7QUFBQSxlQUFBLEdBQWtCLE9BQUEsQ0FBUSx1QkFBUixDQUFsQixDQUFBOztBQUFBO0FBS0MseUJBQUEsSUFBQSxHQUFNLElBQU4sQ0FBQTs7QUFBQSx5QkFDQSxlQUFBLEdBQWlCLElBRGpCLENBQUE7O0FBSWEsRUFBQSxzQkFBRSxJQUFGLEdBQUE7QUFDWixJQURhLElBQUMsQ0FBQSxPQUFBLElBQ2QsQ0FBQTtBQUFBLElBQUEsSUFBQyxDQUFBLGVBQUQsR0FBdUIsSUFBQSxlQUFBLENBQUEsQ0FBdkIsQ0FEWTtFQUFBLENBSmI7O0FBQUEseUJBUUEsY0FBQSxHQUFnQixTQUFBLEdBQUE7QUFDZixRQUFBLFFBQUE7QUFBQSxJQUFBLFFBQUEsR0FBVyxJQUFDLENBQUEsZUFBZSxDQUFDLGNBQWpCLENBQUEsQ0FBWCxDQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsSUFBSSxDQUFDLFdBQU4sQ0FBa0IsUUFBbEIsQ0FEQSxDQUFBO0FBRUEsV0FBTyxRQUFQLENBSGU7RUFBQSxDQVJoQixDQUFBOztBQUFBLHlCQWNBLFlBQUEsR0FBYyxTQUFDLElBQUQsRUFBTyxTQUFQLEdBQUE7QUFDYixJQUFBLElBQUMsQ0FBQSxlQUFlLENBQUMsWUFBakIsQ0FBOEIsSUFBOUIsRUFBb0MsU0FBcEMsQ0FBQSxDQURhO0VBQUEsQ0FkZCxDQUFBOztBQUFBLHlCQW1CQSxTQUFBLEdBQVcsU0FBQyxNQUFELEdBQUE7QUFDVixJQUFBLElBQUMsQ0FBQSxlQUFlLENBQUMsU0FBakIsQ0FBMkIsTUFBM0IsQ0FBQSxDQURVO0VBQUEsQ0FuQlgsQ0FBQTs7c0JBQUE7O0lBTEQsQ0FBQTs7QUFBQSxNQThCTSxDQUFDLE9BQVAsR0FBaUIsWUE5QmpCLENBQUE7Ozs7QUNBQSxJQUFBLDhCQUFBOztBQUFBLFlBQUEsR0FBZSxPQUFBLENBQVEsZ0JBQVIsQ0FBZixDQUFBOztBQUFBLFVBQ0EsR0FBYSxPQUFBLENBQVEsc0JBQVIsQ0FEYixDQUFBOztBQUFBO0FBTUMsRUFBQSxJQUFDLENBQUEsT0FBRCxHQUFVLFNBQUMsSUFBRCxFQUFPLE9BQVAsR0FBQTtBQUNULElBQUEsTUFBTSxDQUFDLGNBQVAsQ0FBc0IsSUFBQyxDQUFBLFNBQXZCLEVBQWtDLElBQWxDLEVBQ0M7QUFBQSxNQUFBLFlBQUEsRUFBYyxJQUFkO0FBQUEsTUFDQSxHQUFBLEVBQUksU0FBQSxHQUFBO2VBQU0sSUFBQyxDQUFBLE9BQUQsQ0FBUyxPQUFBLElBQVcsSUFBcEIsRUFBTjtNQUFBLENBREo7S0FERCxDQUFBLENBRFM7RUFBQSxDQUFWLENBQUE7O0FBQUEsaUJBT0EsSUFBQSxHQUFNLElBUE4sQ0FBQTs7QUFBQSxpQkFVQSxPQUFBLEdBQVMsRUFWVCxDQUFBOztBQUFBLGlCQWFBLElBQUEsR0FBTSxJQUFDLENBQUEsT0FBRCxDQUFTLE1BQVQsQ0FiTixDQUFBOztBQUFBLGlCQWdCQSxNQUFBLEdBQVEsSUFBQyxDQUFBLE9BQUQsQ0FBUyxRQUFULENBaEJSLENBQUE7O0FBQUEsaUJBbUJBLEtBQUEsR0FBTyxJQUFDLENBQUEsT0FBRCxDQUFTLE9BQVQsQ0FuQlAsQ0FBQTs7QUFBQSxpQkFzQkEsU0FBQSxHQUFXLElBQUMsQ0FBQSxPQUFELENBQVMsV0FBVCxDQXRCWCxDQUFBOztBQUFBLGlCQXlCQSxRQUFBLEdBQVUsSUFBQyxDQUFBLE9BQUQsQ0FBUyxVQUFULENBekJWLENBQUE7O0FBQUEsaUJBNEJBLFFBQUEsR0FBVSxJQUFDLENBQUEsT0FBRCxDQUFTLFVBQVQsQ0E1QlYsQ0FBQTs7QUFBQSxpQkErQkEsU0FBQSxHQUFXLElBQUMsQ0FBQSxPQUFELENBQVMsV0FBVCxDQS9CWCxDQUFBOztBQUFBLGlCQWtDQSxZQUFBLEdBQWMsSUFBQyxDQUFBLE9BQUQsQ0FBUyxjQUFULENBbENkLENBQUE7O0FBQUEsaUJBcUNBLGlCQUFBLEdBQW1CLElBQUMsQ0FBQSxPQUFELENBQVMsbUJBQVQsQ0FyQ25CLENBQUE7O0FBQUEsaUJBd0NBLGlCQUFBLEdBQW1CLElBQUMsQ0FBQSxPQUFELENBQVMsbUJBQVQsQ0F4Q25CLENBQUE7O0FBQUEsaUJBMkNBLFNBQUEsR0FBVyxJQUFDLENBQUEsT0FBRCxDQUFTLFdBQVQsQ0EzQ1gsQ0FBQTs7QUFBQSxpQkE4Q0EsV0FBQSxHQUFhLElBQUMsQ0FBQSxPQUFELENBQVMsYUFBVCxDQTlDYixDQUFBOztBQUFBLGlCQWlEQSxVQUFBLEdBQVksSUFqRFosQ0FBQTs7QUFBQSxpQkFvREEsUUFBQSxHQUFVLElBcERWLENBQUE7O0FBQUEsaUJBdURBLFVBQUEsR0FBWSxJQXZEWixDQUFBOztBQTBEYSxFQUFBLGNBQUEsR0FBQTtBQUNaLElBQUEsSUFBQyxDQUFBLEtBQUQsQ0FBTyxDQUFBLFNBQUEsS0FBQSxHQUFBO2FBQUEsU0FBQSxHQUFBO2VBQU0sS0FBQyxDQUFBLElBQUQsR0FBUSxRQUFRLENBQUMsb0JBQVQsQ0FBOEIsTUFBOUIsQ0FBc0MsQ0FBQSxDQUFBLEVBQXBEO01BQUEsRUFBQTtJQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBUCxDQUFBLENBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxVQUFELEdBQWMsRUFEZCxDQUFBO0FBQUEsSUFFQSxJQUFDLENBQUEsVUFBRCxHQUFrQixJQUFBLFVBQUEsQ0FBQSxDQUZsQixDQUFBO0FBR0EsVUFBQSxDQUpZO0VBQUEsQ0ExRGI7O0FBQUEsaUJBbUVBLEtBQUEsR0FBTyxTQUFDLFFBQUQsR0FBQTtBQUNOLElBQUEsTUFBTSxDQUFDLEVBQVAsQ0FBVSxVQUFWLEVBQXNCLFFBQXRCLENBQUEsQ0FETTtFQUFBLENBbkVQLENBQUE7O0FBQUEsaUJBeUVBLEVBQUEsR0FBSSxTQUFDLEdBQUQsR0FBQTtBQUNILFdBQU8sSUFBQyxDQUFBLFVBQVUsQ0FBQyxHQUFaLENBQWdCLEdBQWhCLENBQVAsQ0FERztFQUFBLENBekVKLENBQUE7O0FBQUEsaUJBK0VBLE9BQUEsR0FBUyxTQUFDLElBQUQsR0FBQTtBQUNSLFFBQUEsT0FBQTtBQUFBLElBQUEsSUFBQSxHQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBVixDQUFlLElBQUMsQ0FBQSxPQUFELEdBQVMsSUFBVCxHQUFjLEtBQWQsR0FBb0IsQ0FBSyxJQUFBLElBQUEsQ0FBQSxDQUFNLENBQUMsT0FBUCxDQUFBLENBQUwsQ0FBbkMsQ0FBUCxDQUFBO0FBQ0E7QUFDQyxNQUFBLElBQUEsQ0FBSyxJQUFMLENBQUEsQ0FERDtLQUFBLGNBQUE7QUFHQyxNQURLLFVBQ0wsQ0FBQTtBQUFBLFlBQVUsSUFBQSxLQUFBLENBQU8sb0JBQUEsR0FBbUIsSUFBbkIsR0FBeUIsbUNBQXpCLEdBQTJELENBQUEsQ0FBQyxDQUFDLFVBQUYsQ0FBQSxDQUFBLENBQWxFLENBQVYsQ0FIRDtLQUZRO0VBQUEsQ0EvRVQsQ0FBQTs7QUFBQSxpQkEyRkEsUUFBQSxHQUFVLFNBQUMsSUFBRCxFQUFPLE1BQVAsR0FBQTtBQUNULElBQUEsSUFBQyxDQUFBLFdBQVcsQ0FBQyxRQUFiLENBQXNCLElBQXRCLEVBQTRCLE1BQTVCLENBQUEsQ0FEUztFQUFBLENBM0ZWLENBQUE7O0FBQUEsaUJBbUdBLEdBQUEsR0FBSyxTQUFDLEVBQUQsR0FBQTtBQUNKLFdBQU8sSUFBQyxDQUFBLFlBQVksQ0FBQyxHQUFkLENBQWtCLEVBQWxCLENBQVAsQ0FESTtFQUFBLENBbkdMLENBQUE7O0FBQUEsaUJBMEdBLEtBQUEsR0FBTyxTQUFDLFFBQUQsR0FBQTtBQUNOLFdBQU8sVUFBQSxDQUFXLENBQUEsU0FBQSxLQUFBLEdBQUE7YUFBQSxTQUFBLEdBQUE7QUFDakIsUUFBQSxRQUFBLENBQUEsQ0FBQSxDQURpQjtNQUFBLEVBQUE7SUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQVgsRUFHTixDQUhNLENBQVAsQ0FETTtFQUFBLENBMUdQLENBQUE7O0FBQUEsaUJBb0hBLEtBQUEsR0FBTyxTQUFDLFFBQUQsR0FBQTtBQUNOLFFBQUEsaUNBQUE7QUFBQTtBQUFBLFNBQUEsMkNBQUE7MkJBQUE7QUFDQyxNQUFBLElBQUcsU0FBUyxDQUFDLFdBQWI7QUFDQyxRQUFBLE1BQUEsR0FBUyxJQUFDLENBQUEsaUJBQWlCLENBQUMsS0FBbkIsQ0FBeUIsUUFBekIsRUFBbUMsU0FBbkMsQ0FBVCxDQUFBO0FBQ0EsUUFBQSxJQUFHLE1BQUg7QUFBZSxpQkFBTyxNQUFQLENBQWY7U0FGRDtPQUFBLE1BR0ssSUFBRyxTQUFTLENBQUMsRUFBVixDQUFhLFFBQWIsQ0FBSDtBQUNKLGVBQU8sU0FBUCxDQURJO09BSk47QUFBQSxLQUFBO0FBTUEsV0FBTyxJQUFQLENBUE07RUFBQSxDQXBIUCxDQUFBOztBQUFBLGlCQWlJQSxRQUFBLEdBQVUsU0FBQyxRQUFELEdBQUE7QUFDVCxRQUFBLGtDQUFBO0FBQUEsSUFBQSxPQUFBLEdBQVUsRUFBVixDQUFBO0FBQ0E7QUFBQSxTQUFBLDJDQUFBOzJCQUFBO0FBQ0MsTUFBQSxJQUFHLFNBQVMsQ0FBQyxXQUFiO0FBQ0MsUUFBQSxPQUFPLENBQUMsTUFBUixDQUFlLElBQUMsQ0FBQSxpQkFBaUIsQ0FBQyxRQUFuQixDQUE0QixRQUE1QixFQUFzQyxTQUF0QyxDQUFmLENBQUEsQ0FERDtPQUFBLE1BRUssSUFBRyxTQUFTLENBQUMsRUFBVixDQUFhLFFBQWIsQ0FBSDtBQUNKLFFBQUEsT0FBTyxDQUFDLElBQVIsQ0FBYSxTQUFiLENBQUEsQ0FESTtPQUhOO0FBQUEsS0FEQTtBQU1BLFdBQU8sT0FBUCxDQVBTO0VBQUEsQ0FqSVYsQ0FBQTs7QUFBQSxpQkE4SUEsT0FBQSxHQUFTLFNBQUMsSUFBRCxHQUFBO0FBQ1IsV0FBTyxJQUFDLENBQUEsUUFBUSxDQUFDLEdBQVYsQ0FBYyxJQUFkLENBQVAsQ0FEUTtFQUFBLENBOUlULENBQUE7O0FBQUEsaUJBcUpBLEtBQUEsR0FBTyxTQUFDLElBQUQsR0FBQTtBQUNOLFdBQU8sSUFBQyxDQUFBLFFBQVEsQ0FBQyxHQUFWLENBQWMsSUFBZCxDQUFQLENBRE07RUFBQSxDQXJKUCxDQUFBOztBQUFBLGlCQTRKQSxLQUFBLEdBQU8sU0FBQyxJQUFELEdBQUE7QUFDTixXQUFPLElBQUMsQ0FBQSxRQUFRLENBQUMsR0FBVixDQUFjLElBQWQsQ0FBUCxDQURNO0VBQUEsQ0E1SlAsQ0FBQTs7QUFBQSxpQkFtS0EsaUJBQUEsR0FBbUIsU0FBQyxJQUFELEVBQU8sU0FBUCxHQUFBO0FBQ2xCLElBQUEsSUFBQyxDQUFBLFVBQVcsQ0FBQSxJQUFBLENBQVosR0FBb0IsU0FBcEIsQ0FEa0I7RUFBQSxDQW5LbkIsQ0FBQTs7QUFBQSxpQkEwS0Esa0JBQUEsR0FBb0IsU0FBQSxHQUFBO0FBQ25CLFFBQUEsbUNBQUE7QUFBQSxJQUFBLFlBQUEsR0FBbUIsSUFBQSxZQUFBLENBQWEsSUFBYixDQUFuQixDQUFBO0FBQ0E7QUFBQSxTQUFBLFlBQUE7NkJBQUE7QUFDQyxNQUFBLFlBQVksQ0FBQyxZQUFiLENBQTBCLElBQTFCLEVBQW9DLElBQUEsU0FBQSxDQUFBLENBQXBDLENBQUEsQ0FERDtBQUFBLEtBREE7QUFHQSxXQUFPLFlBQVAsQ0FKbUI7RUFBQSxDQTFLcEIsQ0FBQTs7QUFBQSxpQkFtTEEsV0FBQSxHQUFhLFNBQUUsUUFBRixHQUFBO0FBQ1osUUFBQSxtQkFBQTtBQUFBLElBRGEsSUFBQyxDQUFBLFdBQUEsUUFDZCxDQUFBO0FBQUEsSUFBQSxJQUFDLENBQUEsUUFBUSxDQUFDLEdBQVYsQ0FBYyxZQUFkLEVBQTRCLElBQUMsQ0FBQSxVQUE3QixDQUFBLENBQUE7QUFDQTtBQUFBLFNBQUEsWUFBQTsyQkFBQTtBQUNDLE1BQUEsSUFBSSxDQUFDLE9BQUwsQ0FBYSxJQUFiLEVBQW1CLE9BQW5CLENBQUEsQ0FERDtBQUFBLEtBRlk7RUFBQSxDQW5MYixDQUFBOztBQUFBLGlCQTBMQSxJQUFBLEdBQU0sU0FBQyxNQUFELEdBQUE7QUFDTCxRQUFBLHNCQUFBO0FBQUEsSUFBQSxJQUFHLElBQUMsQ0FBQSxRQUFKO0FBQWtCLGFBQU8sSUFBQyxDQUFBLFFBQVIsQ0FBbEI7S0FBQTtBQUFBLElBQ0EsWUFBQSxHQUFlLElBQUMsQ0FBQSxrQkFBRCxDQUFBLENBRGYsQ0FBQTtBQUVBLElBQUEsSUFBd0IsTUFBeEI7QUFBQSxNQUFBLE1BQUEsQ0FBTyxZQUFQLENBQUEsQ0FBQTtLQUZBO0FBQUEsSUFHQSxRQUFBLEdBQVcsWUFBWSxDQUFDLGNBQWIsQ0FBQSxDQUhYLENBQUE7QUFJQSxXQUFPLFFBQVAsQ0FMSztFQUFBLENBMUxOLENBQUE7O2NBQUE7O0lBTkQsQ0FBQTs7QUFBQSxNQXlNTSxDQUFDLE9BQVAsR0FBaUIsR0FBQSxDQUFBLElBek1qQixDQUFBOzs7O0FDQUEsSUFBQSxxQkFBQTtFQUFBOztvQkFBQTs7QUFBQSxVQUFBLEdBQWEsT0FBQSxDQUFRLGdCQUFSLENBQWIsQ0FBQTs7QUFBQTtBQU1DLDhCQUFBLENBQUE7O0FBQUEsc0JBQUEsV0FBQSxHQUFhLElBQWIsQ0FBQTs7QUFBQSxzQkFHQSxLQUFBLEdBQU8sV0FIUCxDQUFBOztBQUFBLHNCQU1BLEVBQUEsR0FBSSxJQU5KLENBQUE7O0FBQUEsc0JBU0EsSUFBQSxHQUFNLElBVE4sQ0FBQTs7QUFBQSxzQkFZQSxLQUFBLEdBQU8sTUFaUCxDQUFBOztBQUFBLHNCQWVBLE1BQUEsR0FBUSxNQWZSLENBQUE7O0FBQUEsc0JBa0JBLEdBQUEsR0FBSyxJQWxCTCxDQUFBOztBQUFBLHNCQXFCQSxJQUFBLEdBQU0sSUFyQk4sQ0FBQTs7QUFBQSxzQkF3QkEsS0FBQSxHQUFPLElBeEJQLENBQUE7O0FBQUEsc0JBMkJBLE1BQUEsR0FBUSxJQTNCUixDQUFBOztBQUFBLHNCQThCQSxPQUFBLEdBQVMsSUE5QlQsQ0FBQTs7QUFBQSxzQkFpQ0EsTUFBQSxHQUFRLElBakNSLENBQUE7O0FBQUEsc0JBb0NBLElBQUEsR0FBTSxJQXBDTixDQUFBOztBQUFBLHNCQXVDQSxNQUFBLEdBQVEsSUF2Q1IsQ0FBQTs7QUFBQSxzQkEwQ0EsR0FBQSxHQUFLLElBMUNMLENBQUE7O0FBQUEsc0JBNkNBLE9BQUEsR0FBUyxFQTdDVCxDQUFBOztBQUFBLHNCQWdEQSxZQUFBLEdBQWMsRUFoRGQsQ0FBQTs7QUFBQSxzQkFtREEsU0FBQSxHQUFXLElBbkRYLENBQUE7O0FBQUEsc0JBdURBLEVBQUEsR0FBSSxLQXZESixDQUFBOztBQUFBLHNCQTJEQSxTQUFBLEdBQVcsSUEzRFgsQ0FBQTs7QUFBQSxzQkE4REEsUUFBQSxHQUFVLElBOURWLENBQUE7O0FBQUEsc0JBaUVBLE9BQUEsR0FBUyxJQWpFVCxDQUFBOztBQUFBLHNCQW9FQSxRQUFBLEdBQVUsS0FwRVYsQ0FBQTs7QUFBQSxzQkF1RUEsU0FBQSxHQUFXLEtBdkVYLENBQUE7O0FBQUEsc0JBMEVBLFNBQUEsR0FBVyxLQTFFWCxDQUFBOztBQUFBLHNCQTZFQSxNQUFBLEdBQVEsSUE3RVIsQ0FBQTs7QUFBQSxzQkFnRkEsWUFBQSxHQUFjLEtBaEZkLENBQUE7O0FBQUEsc0JBbUZBLGNBQUEsR0FBZ0IsSUFuRmhCLENBQUE7O0FBQUEsc0JBc0ZBLEtBQUEsR0FBTyxLQXRGUCxDQUFBOztBQUFBLHNCQXlGQSxPQUFBLEdBQVMsSUF6RlQsQ0FBQTs7QUFBQSxzQkE0RkEsUUFBQSxHQUFVLElBNUZWLENBQUE7O0FBQUEsc0JBZ0dBLFFBQUEsR0FBVSxJQWhHVixDQUFBOztBQUFBLHNCQW1HQSxVQUFBLEdBQVksS0FuR1osQ0FBQTs7QUFBQSxzQkFzR0EsVUFBQSxHQUFZLEtBdEdaLENBQUE7O0FBQUEsc0JBeUdBLFFBQUEsR0FBVSxLQXpHVixDQUFBOztBQUFBLHNCQTRHQSxJQUFBLEdBQU0sSUE1R04sQ0FBQTs7QUFBQSxzQkErR0EsT0FBQSxHQUFTLElBL0dULENBQUE7O0FBQUEsc0JBa0hBLFdBQUEsR0FBYSxLQWxIYixDQUFBOztBQUFBLHNCQXFIQSxTQUFBLEdBQVcsSUFySFgsQ0FBQTs7QUFBQSxzQkF1SEEsY0FBQSxHQUFnQixLQXZIaEIsQ0FBQTs7QUFBQSxzQkF3SEEsU0FBQSxHQUFXLElBeEhYLENBQUE7O0FBQUEsc0JBeUhBLFlBQUEsR0FBYyxJQXpIZCxDQUFBOztBQTRIYSxFQUFBLG1CQUFDLE1BQUQsR0FBQTtBQUNaLElBQUEsSUFBQyxDQUFBLE9BQUQsR0FBVyxFQUFYLENBQUE7QUFBQSxJQUdBLElBQUMsQ0FBQSxVQUFELENBQUEsQ0FIQSxDQUFBO0FBSUEsSUFBQSxJQUFHLENBQUEsSUFBRSxDQUFBLGdCQUFMO0FBQTJCLFlBQVUsSUFBQSxLQUFBLENBQU8sZUFBQSxHQUFjLElBQWQsR0FBaUIsc0NBQXhCLENBQVYsQ0FBM0I7S0FKQTtBQUFBLElBT0EsMkNBQU0sTUFBTixDQVBBLENBQUE7QUFBQSxJQVVBLElBQUMsQ0FBQSxNQUFELENBQUEsQ0FWQSxDQUFBO0FBV0EsSUFBQSxJQUFHLENBQUEsSUFBRSxDQUFBLFlBQUw7QUFBdUIsWUFBVSxJQUFBLEtBQUEsQ0FBTyxlQUFBLEdBQWMsSUFBZCxHQUFpQixrQ0FBeEIsQ0FBVixDQUF2QjtLQVhBO0FBQUEsSUFjQSxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQWxCLENBQTJCLElBQTNCLENBZEEsQ0FBQTtBQWVBLElBQUEsSUFBa0MsSUFBQyxDQUFBLFlBQW5DO0FBQUEsTUFBQSxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQWYsQ0FBd0IsSUFBeEIsQ0FBQSxDQUFBO0tBZkE7QUFBQSxJQWtCQSxJQUFDLENBQUEsU0FBRCxDQUFBLENBbEJBLENBQUE7QUFtQkEsSUFBQSxJQUFHLENBQUEsSUFBRSxDQUFBLGVBQUw7QUFBMEIsWUFBVSxJQUFBLEtBQUEsQ0FBTyxlQUFBLEdBQWMsSUFBZCxHQUFpQixxQ0FBeEIsQ0FBVixDQUExQjtLQW5CQTtBQUFBLElBb0JBLElBQUMsQ0FBQSxXQUFELENBQWEsTUFBYixFQUFxQixJQUFyQixDQXBCQSxDQUFBO0FBcUJBLFVBQUEsQ0F0Qlk7RUFBQSxDQTVIYjs7QUFBQSxzQkFxSkEsVUFBQSxHQUFZLFNBQUEsR0FBQTtBQUNYLElBQUEsSUFBQyxDQUFBLGdCQUFELEdBQW9CLElBQXBCLENBRFc7RUFBQSxDQXJKWixDQUFBOztBQUFBLHNCQTJKQSxNQUFBLEdBQVEsU0FBQSxHQUFBO0FBQ1AsUUFBQSxTQUFBO0FBQUEsSUFBQSxJQUFDLENBQUEsWUFBRCxHQUFnQixJQUFoQixDQUFBO0FBR0EsSUFBQSxJQUFHLENBQUEsSUFBRSxDQUFBLElBQUw7QUFDQyxNQUFBLElBQUMsQ0FBQSxJQUFELEdBQVEsSUFBSSxDQUFDLFlBQVksQ0FBQyxVQUFsQixDQUE2QixJQUFDLENBQUEsS0FBOUIsQ0FBUixDQUREO0tBSEE7QUFPQSxJQUFBLElBQUcsQ0FBQSxJQUFFLENBQUEsRUFBTDtBQUNDLE1BQUEsSUFBQyxDQUFBLEVBQUQsR0FBTSxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQWxCLENBQUEsQ0FBTixDQUFBO0FBQUEsTUFDQSxJQUFDLENBQUEsY0FBRCxHQUFrQixJQURsQixDQUREO0tBUEE7QUFBQSxJQVlBLElBQUMsQ0FBQSxFQUFELEdBQU0sSUFBQyxDQUFBLGFBQUQsQ0FBZSxJQUFDLENBQUEsRUFBaEIsQ0FaTixDQUFBO0FBZUEsSUFBQSxJQUFHLElBQUMsQ0FBQSxTQUFKO0FBQ0MsTUFBQSxJQUFDLENBQUEsU0FBRCxHQUFhLElBQUMsQ0FBQSxhQUFELENBQWUsSUFBQyxDQUFBLFNBQWhCLENBQWIsQ0FBQTtBQUFBLE1BQ0EsSUFBQyxDQUFBLFNBQVMsQ0FBQyxNQUFYLENBQWtCLElBQUMsQ0FBQSxFQUFuQixDQURBLENBQUE7QUFBQSxNQUVBLElBQUMsQ0FBQSxTQUFTLENBQUMsUUFBWCxDQUFvQixTQUFwQixDQUZBLENBREQ7S0FmQTtBQXFCQSxJQUFBLElBQUcsSUFBQyxDQUFBLE9BQUQsS0FBWSxJQUFmO0FBQ0MsTUFBQSxJQUFDLENBQUEsT0FBRCxHQUFXLElBQUMsQ0FBQSxFQUFaLENBREQ7S0FyQkE7QUF3QkEsSUFBQSxJQUFHLElBQUMsQ0FBQSxXQUFKO0FBQ0MsTUFBQSxTQUFBLEdBQVksSUFBQyxDQUFBLFNBQUQsSUFBYyxJQUFDLENBQUEsRUFBM0IsQ0FBQTtBQUNBLE1BQUEsSUFBRyxDQUFBLFNBQUg7QUFDQyxjQUFVLElBQUEsS0FBQSxDQUFNLDRFQUFOLENBQVYsQ0FERDtPQURBO0FBQUEsTUFHQSxJQUFDLENBQUEsS0FBRCxHQUFTLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUF2QixDQUFpQyxTQUFqQyxDQUhULENBREQ7S0F6Qk87RUFBQSxDQTNKUixDQUFBOztBQUFBLHNCQThMQSxTQUFBLEdBQVcsU0FBQSxHQUFBO0FBQ1YsUUFBQSxNQUFBO0FBQUEsSUFBQSxJQUFDLENBQUEsZUFBRCxHQUFtQixJQUFuQixDQUFBO0FBQ0EsSUFBQSxJQUFHLElBQUMsQ0FBQSxTQUFKO0FBQ0MsTUFBQSxNQUFBLEdBQVMsSUFBQyxDQUFBLFNBQVYsQ0FBQTtBQUFBLE1BQ0EsTUFBQSxDQUFBLElBQVEsQ0FBQSxTQURSLENBQUE7QUFBQSxNQUVBLE1BQU0sQ0FBQyxZQUFQLENBQW9CLElBQXBCLENBRkEsQ0FERDtLQUZVO0VBQUEsQ0E5TFgsQ0FBQTs7QUFBQSxzQkEwTUEsYUFBQSxHQUFlLFNBQUMsT0FBRCxHQUFBO0FBQ2QsUUFBQSxHQUFBO0FBQUEsSUFBQSxJQUFHLElBQUksQ0FBQyxRQUFMLENBQWMsT0FBZCxDQUFIO0FBQ0MsYUFBVyxJQUFBLE9BQUEsQ0FBUSxPQUFSLENBQVgsQ0FERDtLQUFBLE1BQUE7QUFHQyxNQUFBLEdBQUEsR0FBTSxPQUFPLENBQUMsR0FBUixJQUFlLEtBQXJCLENBQUE7QUFBQSxNQUNBLE1BQUEsQ0FBQSxPQUFjLENBQUMsR0FEZixDQUFBO0FBRUEsYUFBVyxJQUFBLE9BQUEsQ0FBUSxHQUFSLEVBQWEsT0FBYixDQUFYLENBTEQ7S0FEYztFQUFBLENBMU1mLENBQUE7O0FBQUEsc0JBd05BLEtBQUEsR0FBTyxTQUFDLEVBQUQsR0FBQTtBQUNOLFFBQUEsS0FBQTtBQUFBLElBQUEsSUFBQyxDQUFBLGNBQUQsR0FBa0IsS0FBbEIsQ0FBQTtBQUFBLElBQ0EsS0FBQSxHQUFRLElBQUMsQ0FBQSxFQURULENBQUE7QUFFQSxJQUFBLElBQUcsSUFBQyxDQUFBLEVBQUQsS0FBUyxFQUFaO0FBQ0MsTUFBQSxJQUFDLENBQUEsRUFBRCxHQUFNLEVBQU4sQ0FBQTtBQUFBLE1BQ0EsSUFBQyxDQUFBLEVBQUUsQ0FBQyxHQUFKLENBQVEsSUFBUixFQUFjLEVBQWQsQ0FEQSxDQUFBO0FBQUEsTUFFQSxJQUFDLENBQUEsSUFBRCxDQUFNLFVBQU4sRUFBa0IsSUFBbEIsRUFBd0IsRUFBeEIsRUFBNEIsS0FBNUIsQ0FGQSxDQUREO0tBSE07RUFBQSxDQXhOUCxDQUFBOztBQUFBLHNCQWtPQSxPQUFBLEdBQVMsU0FBQSxHQUFBO0FBQ1IsV0FBTyxJQUFDLENBQUEsSUFBUixDQURRO0VBQUEsQ0FsT1QsQ0FBQTs7QUFBQSxzQkFzT0EsVUFBQSxHQUFZLFNBQUMsTUFBRCxHQUFBO0FBQ1gsV0FBTyxJQUFDLENBQUEsT0FBRCxHQUFZLENBQUksTUFBSCxHQUFlLEdBQUEsR0FBTSxNQUFyQixHQUFpQyxFQUFsQyxDQUFuQixDQURXO0VBQUEsQ0F0T1osQ0FBQTs7QUFBQSxzQkEwT0EsWUFBQSxHQUFjLFNBQUEsR0FBQTtBQUNiLFdBQU8sSUFBQyxDQUFBLFNBQUQsSUFBYyxJQUFDLENBQUEsRUFBdEIsQ0FEYTtFQUFBLENBMU9kLENBQUE7O0FBQUEsc0JBOE9BLFlBQUEsR0FBYyxTQUFDLEVBQUQsR0FBQTtBQUNiLElBQUEsSUFBQyxDQUFBLFNBQUQsR0FBYSxFQUFiLENBRGE7RUFBQSxDQTlPZCxDQUFBOztBQUFBLHNCQW1QQSxVQUFBLEdBQVksU0FBQSxHQUFBO1dBQ1gsSUFBQyxDQUFBLFFBRFU7RUFBQSxDQW5QWixDQUFBOztBQXVQQTtBQUFBOzs7OztLQXZQQTs7QUFBQSxzQkErUEEsV0FBQSxHQUFhLFNBQUMsRUFBRCxFQUFLLFFBQUwsR0FBQTtBQUNaLElBQUEsSUFBQyxDQUFBLFFBQUQsR0FBWSxDQUFJLFFBQUEsS0FBWSxPQUFaLElBQXVCLFFBQUEsS0FBWSxRQUF0QyxHQUFvRCxFQUFFLENBQUMsU0FBSCxDQUFBLENBQXBELEdBQXdFLEVBQXpFLENBQVosQ0FBQTtBQUFBLElBQ0EsSUFBQyxDQUFBLEVBQUUsQ0FBQyxNQUFKLENBQVcsRUFBWCxFQUFlLFFBQWYsQ0FEQSxDQURZO0VBQUEsQ0EvUGIsQ0FBQTs7QUFBQSxzQkFxUUEsV0FBQSxHQUFhLFNBQUEsR0FBQTtBQUNaLFdBQU8sSUFBQyxDQUFBLFFBQVIsQ0FEWTtFQUFBLENBclFiLENBQUE7O0FBQUEsc0JBeVFBLFVBQUEsR0FBWSxTQUFDLFFBQUQsR0FBQTtBQUNYLFdBQU8sSUFBQyxDQUFBLEVBQUUsQ0FBQyxVQUFKLENBQWUsUUFBZixDQUFQLENBRFc7RUFBQSxDQXpRWixDQUFBOztBQUFBLHNCQTZRQSxXQUFBLEdBQWEsU0FBQyxRQUFELEdBQUE7QUFDWixXQUFPLElBQUMsQ0FBQSxFQUFFLENBQUMsV0FBSixDQUFnQixRQUFoQixDQUFQLENBRFk7RUFBQSxDQTdRYixDQUFBOztBQUFBLHNCQXNSQSxTQUFBLEdBQVcsU0FBQyxNQUFELEdBQUE7QUFDVixJQUFBLElBQUMsQ0FBQSxFQUFFLENBQUMsUUFBSixDQUFhLFNBQWIsRUFBd0IsTUFBeEIsQ0FBQSxDQUFBO0FBQ0EsV0FBTyxNQUFBLEdBQVMsRUFBaEIsQ0FGVTtFQUFBLENBdFJYLENBQUE7O0FBQUEsc0JBMlJBLFNBQUEsR0FBVyxTQUFBLEdBQUE7QUFDVixXQUFPLFFBQUEsQ0FBUyxJQUFDLENBQUEsRUFBRSxDQUFDLFFBQUosQ0FBYSxTQUFiLENBQVQsRUFBa0MsRUFBbEMsQ0FBUCxDQURVO0VBQUEsQ0EzUlgsQ0FBQTs7QUFBQSxzQkErUkEsT0FBQSxHQUFTLFNBQUEsR0FBQTtBQUNSLElBQUEsSUFBQyxDQUFBLGdCQUFELENBQUEsQ0FBbUIsQ0FBQyxZQUFwQixDQUFpQyxJQUFqQyxDQUFBLENBRFE7RUFBQSxDQS9SVCxDQUFBOztBQUFBLHNCQW9TQSxNQUFBLEdBQVEsU0FBQSxHQUFBO0FBQ1AsSUFBQSxJQUFDLENBQUEsZ0JBQUQsQ0FBQSxDQUFtQixDQUFDLFVBQXBCLENBQStCLElBQS9CLENBQUEsQ0FETztFQUFBLENBcFNSLENBQUE7O0FBQUEsc0JBeVNBLGdCQUFBLEdBQWtCLFNBQUEsR0FBQTtBQUNqQixJQUFBLElBQUcsQ0FBQSxJQUFFLENBQUEsU0FBTDtBQUFvQixZQUFVLElBQUEsS0FBQSxDQUFPLFlBQUEsR0FBVyxJQUFDLENBQUEsSUFBWixHQUFrQixvQ0FBekIsQ0FBVixDQUFwQjtLQUFBO0FBQ0EsV0FBTyxJQUFDLENBQUEsU0FBUixDQUZpQjtFQUFBLENBelNsQixDQUFBOztBQUFBLHNCQW1UQSxTQUFBLEdBQVcsU0FBQyxNQUFELEVBQVMsU0FBVCxHQUFBO0FBQ1YsSUFBQSxJQUFDLENBQUEsSUFBRCxDQUFNLENBQUksTUFBSCxHQUFlLFdBQWYsR0FBZ0MsYUFBakMsQ0FBTixFQUF1RCxJQUF2RCxDQUFBLENBRFU7RUFBQSxDQW5UWCxDQUFBOztBQUFBLHNCQXdUQSxXQUFBLEdBQWEsU0FBQyxRQUFELEdBQUE7QUFDWixJQUFBLElBQUMsQ0FBQSxRQUFELEdBQVksUUFBWixDQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsSUFBRCxDQUFNLFVBQU4sRUFBa0IsSUFBbEIsRUFBd0IsUUFBeEIsQ0FEQSxDQUFBO0FBRUEsSUFBQSxJQUE0QyxJQUFDLENBQUEsV0FBRCxDQUFBLENBQTVDO0FBQUEsTUFBQSxJQUFDLENBQUEsVUFBRCxDQUFBLENBQWEsQ0FBQyxHQUFkLENBQWtCLFVBQWxCLEVBQThCLENBQUEsUUFBOUIsQ0FBQSxDQUFBO0tBSFk7RUFBQSxDQXhUYixDQUFBOztBQUFBLHNCQStUQSxRQUFBLEdBQVUsU0FBQyxNQUFELEdBQUE7QUFDVCxJQUFBLElBQUcsSUFBQyxDQUFBLFFBQUo7QUFBa0IsWUFBQSxDQUFsQjtLQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsS0FBRCxHQUFTLElBRFQsQ0FBQTtBQUVBLElBQUEsSUFBNEIsSUFBQyxDQUFBLFdBQUQsQ0FBQSxDQUE1QjtBQUFBLE1BQUEsSUFBQyxDQUFBLFVBQUQsQ0FBQSxDQUFhLENBQUMsUUFBZCxDQUFBLENBQUEsQ0FBQTtLQUZBO0FBR0EsSUFBQSxJQUF3QixDQUFBLE1BQXhCO0FBQUEsTUFBQSxJQUFDLENBQUEsSUFBRCxDQUFNLE9BQU4sRUFBZSxJQUFmLENBQUEsQ0FBQTtLQUpTO0VBQUEsQ0EvVFYsQ0FBQTs7QUFBQSxzQkF1VUEsSUFBQSxHQUFNLFNBQUMsTUFBRCxHQUFBO0FBQ0wsSUFBQSxJQUFHLElBQUMsQ0FBQSxRQUFKO0FBQWtCLFlBQUEsQ0FBbEI7S0FBQTtBQUFBLElBQ0EsSUFBQyxDQUFBLEtBQUQsR0FBUyxLQURULENBQUE7QUFFQSxJQUFBLElBQXdCLElBQUMsQ0FBQSxXQUFELENBQUEsQ0FBeEI7QUFBQSxNQUFBLElBQUMsQ0FBQSxVQUFELENBQUEsQ0FBYSxDQUFDLElBQWQsQ0FBQSxDQUFBLENBQUE7S0FGQTtBQUdBLElBQUEsSUFBdUIsQ0FBQSxNQUF2QjtBQUFBLE1BQUEsSUFBQyxDQUFBLElBQUQsQ0FBTSxNQUFOLEVBQWMsSUFBZCxDQUFBLENBQUE7S0FKSztFQUFBLENBdlVOLENBQUE7O0FBQUEsc0JBK1VBLFdBQUEsR0FBYSxTQUFBLEdBQUE7QUFDWixXQUFPLElBQUMsQ0FBQSxPQUFELElBQWEsSUFBQyxDQUFBLFFBQWQsSUFBMkIsSUFBQyxDQUFBLFNBQUQsQ0FBQSxDQUFsQyxDQURZO0VBQUEsQ0EvVWIsQ0FBQTs7QUFBQSxzQkFtVkEsWUFBQSxHQUFjLFNBQUEsR0FBQTtBQUNiLElBQUEsSUFBRyxJQUFDLENBQUEsVUFBRCxLQUFlLElBQWxCO0FBRUMsYUFBTyxJQUFDLENBQUEsTUFBRCxJQUFXLENBQUMsSUFBQyxDQUFBLEdBQUQsS0FBVSxJQUFWLElBQW1CLElBQUMsQ0FBQSxNQUFELEtBQWEsSUFBakMsQ0FBbEIsQ0FGRDtLQUFBLE1BQUE7QUFLQyxhQUFRLElBQUMsQ0FBQSxVQUFULENBTEQ7S0FEYTtFQUFBLENBblZkLENBQUE7O0FBQUEsc0JBaVdBLFNBQUEsR0FBVyxTQUFDLE1BQUQsRUFBUyxJQUFULEdBQUE7QUFDVixJQUFBLElBQUcsTUFBQSxLQUFVLElBQVYsSUFBbUIsSUFBQyxDQUFBLFNBQUQsS0FBYyxJQUFqQyxJQUEwQyxJQUFBLEtBQVUsSUFBdkQ7QUFDQyxNQUFBLElBQUMsQ0FBQSxJQUFELEdBQVEsSUFBUixDQUFBO0FBQ0EsYUFBTyxJQUFQLENBRkQ7S0FBQSxNQUdLLElBQUcsTUFBQSxLQUFVLElBQUMsQ0FBQSxTQUFYLElBQXlCLElBQUEsS0FBUSxJQUFwQztBQUNKLGFBQU8sSUFBUCxDQURJO0tBSEw7QUFPQSxJQUFBLElBQUcsSUFBQyxDQUFBLFNBQUQsS0FBZ0IsSUFBaEIsSUFBeUIsTUFBQSxLQUFZLElBQXhDO0FBQ0MsWUFBVSxJQUFBLEtBQUEsQ0FBTyxhQUFBLEdBQVksSUFBQyxDQUFBLElBQWIsR0FBbUIsMEJBQW5CLEdBQTRDLElBQUMsQ0FBQSxTQUFTLENBQUMsSUFBdkQsR0FBNkQsZ0NBQTdELEdBQTRGLE1BQU0sQ0FBQyxJQUFuRyxHQUF5RyxJQUFoSCxDQUFWLENBREQ7S0FQQTtBQVdBLElBQUEsSUFBRyxJQUFIO0FBQWEsTUFBQSxJQUFDLENBQUEsSUFBRCxHQUFRLElBQVIsQ0FBYjtLQVhBO0FBY0EsSUFBQSxJQUFHLE1BQUEsS0FBWSxJQUFmO0FBQ0MsTUFBQSxJQUFDLENBQUEsU0FBRCxHQUFhLE1BQWIsQ0FBQTtBQUFBLE1BQ0EsSUFBQyxDQUFBLGlCQUFELENBQW1CLElBQUMsQ0FBQSxTQUFwQixDQURBLENBQUE7QUFBQSxNQUVBLElBQUMsQ0FBQSxJQUFELENBQU0sVUFBTixFQUFrQixJQUFsQixFQUF3QixNQUF4QixDQUZBLENBREQ7S0FBQSxNQUFBO0FBS0MsTUFBQSxJQUFDLENBQUEsaUJBQUQsQ0FBbUIsSUFBQyxDQUFBLFNBQXBCLENBQUEsQ0FBQTtBQUFBLE1BQ0EsSUFBQyxDQUFBLElBQUQsQ0FBTSxVQUFOLEVBQWtCLElBQWxCLENBREEsQ0FBQTtBQUFBLE1BRUEsSUFBQyxDQUFBLFNBQUQsR0FBYSxJQUZiLENBTEQ7S0FkQTtBQXNCQSxXQUFPLElBQVAsQ0F2QlU7RUFBQSxDQWpXWCxDQUFBOztBQUFBLHNCQTJYQSxFQUFBLEdBQUksU0FBQyxRQUFELEdBQUE7QUFDSCxXQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxFQUF2QixDQUEwQixJQUExQixFQUFnQyxRQUFoQyxDQUFQLENBREc7RUFBQSxDQTNYSixDQUFBOztBQUFBLHNCQStYQSxPQUFBLEdBQVMsU0FBQyxLQUFELEdBQUE7QUFDUixXQUFRLElBQUMsQ0FBQSxLQUFELEtBQVUsS0FBbEIsQ0FEUTtFQUFBLENBL1hULENBQUE7O0FBQUEsc0JBbVlBLFNBQUEsR0FBVyxTQUFDLFFBQUQsR0FBQTtBQUNILElBQUEsSUFBRyxRQUFIO2FBQWlCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxXQUF2QixDQUFtQyxJQUFuQyxFQUF5QyxRQUF6QyxFQUFqQjtLQUFBLE1BQUE7YUFBeUUsSUFBQyxDQUFBLFVBQTFFO0tBREc7RUFBQSxDQW5ZWCxDQUFBOztBQUFBLHNCQXVZQSxXQUFBLEdBQWEsU0FBQSxHQUFBO0FBQ1osV0FBTyxJQUFDLENBQUEsU0FBRCxDQUFBLENBQVksQ0FBQyxhQUFiLENBQTJCLElBQTNCLENBQVAsQ0FEWTtFQUFBLENBdlliLENBQUE7O0FBQUEsc0JBMllBLGVBQUEsR0FBaUIsU0FBQSxHQUFBO0FBQ2hCLFdBQU8sSUFBQyxDQUFBLFNBQUQsQ0FBQSxDQUFZLENBQUMsaUJBQWIsQ0FBK0IsSUFBL0IsQ0FBUCxDQURnQjtFQUFBLENBM1lqQixDQUFBOztBQUFBLHNCQWdaQSxpQkFBQSxHQUFtQixTQUFDLE1BQUQsR0FBQSxDQWhabkIsQ0FBQTs7QUFBQSxzQkFxWkEsaUJBQUEsR0FBbUIsU0FBQyxNQUFELEdBQUEsQ0FyWm5CLENBQUE7O0FBQUEsc0JBOFpBLGFBQUEsR0FBZSxTQUFDLElBQUQsRUFBTyxNQUFQLEdBQUE7QUFDZCxJQUFBLElBQUcsSUFBQyxDQUFBLE9BQVEsQ0FBQSxJQUFBLENBQVo7QUFBdUIsWUFBVSxJQUFBLEtBQUEsQ0FBTyxTQUFBLEdBQVEsSUFBUixHQUFjLGtDQUFkLEdBQStDLElBQXRELENBQVYsQ0FBdkI7S0FBQTtBQUFBLElBQ0EsSUFBQyxDQUFBLE9BQVEsQ0FBQSxJQUFBLENBQVQsR0FBaUIsTUFEakIsQ0FEYztFQUFBLENBOVpmLENBQUE7O0FBQUEsc0JBb2FBLGVBQUEsR0FBaUIsU0FBQyxJQUFELEdBQUE7QUFDaEIsSUFBQSxJQUFHLENBQUEsSUFBRSxDQUFBLE9BQVEsQ0FBQSxJQUFBLENBQWI7QUFBd0IsWUFBQSxDQUF4QjtLQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsT0FBUSxDQUFBLElBQUEsQ0FBSyxDQUFDLE9BQWYsQ0FBQSxDQURBLENBQUE7QUFBQSxJQUVBLE1BQUEsQ0FBQSxJQUFRLENBQUEsT0FBUSxDQUFBLElBQUEsQ0FGaEIsQ0FEZ0I7RUFBQSxDQXBhakIsQ0FBQTs7QUFBQSxzQkEyYUEsU0FBQSxHQUFXLFNBQUMsSUFBRCxHQUFBO0FBQ1YsSUFBQSxJQUFHLENBQUEsSUFBRSxDQUFBLE9BQVEsQ0FBQSxJQUFBLENBQWI7QUFBd0IsWUFBVSxJQUFBLEtBQUEsQ0FBTyxTQUFBLEdBQVEsSUFBUixHQUFjLGlDQUFkLEdBQThDLElBQXJELENBQVYsQ0FBeEI7S0FBQTtBQUNBLFdBQU8sSUFBQyxDQUFBLE9BQVEsQ0FBQSxJQUFBLENBQWhCLENBRlU7RUFBQSxDQTNhWCxDQUFBOztBQUFBLHNCQWdiQSxTQUFBLEdBQVcsU0FBQyxJQUFELEdBQUE7QUFDVixXQUFPLElBQUMsQ0FBQSxPQUFRLENBQUEsSUFBQSxDQUFULEtBQW9CLE1BQTNCLENBRFU7RUFBQSxDQWhiWCxDQUFBOztBQUFBLHNCQW9iQSxXQUFBLEdBQWEsU0FBQSxHQUFBO0FBQ1osUUFBQSxnQ0FBQTtBQUFBLElBRGEsdUJBQVEsOERBQ3JCLENBQUE7QUFBQTtBQUFBLFNBQUEsWUFBQTswQkFBQTtBQUNDLE1BQUEsSUFBRyxNQUFPLENBQUEsTUFBQSxDQUFWO0FBQ0MsUUFBQSxNQUFPLENBQUEsTUFBQSxDQUFPLENBQUMsS0FBZixDQUFxQixNQUFyQixFQUE2QixJQUE3QixDQUFBLENBREQ7T0FERDtBQUFBLEtBRFk7RUFBQSxDQXBiYixDQUFBOztBQUFBLHNCQWdjQSxXQUFBLEdBQWEsU0FBQSxHQUFBO0FBQ1osV0FBTyxJQUFDLENBQUEsUUFBRCxLQUFlLElBQXRCLENBRFk7RUFBQSxDQWhjYixDQUFBOztBQUFBLHNCQW9jQSxXQUFBLEdBQWEsU0FBQSxHQUFBO0FBQ1osSUFBQSxJQUFHLElBQUMsQ0FBQSxRQUFELElBQWMsSUFBSSxDQUFDLFFBQUwsQ0FBYyxJQUFDLENBQUEsUUFBZixDQUFqQjtBQUNDLE1BQUEsSUFBQyxDQUFBLFFBQUQsR0FBWSxJQUFDLENBQUEsY0FBRCxDQUFnQixJQUFDLENBQUEsUUFBakIsQ0FBWixDQUREO0tBQUE7QUFFQSxXQUFPLElBQUMsQ0FBQSxRQUFSLENBSFk7RUFBQSxDQXBjYixDQUFBOztBQUFBLHNCQTBjQSxjQUFBLEdBQWdCLFNBQUMsTUFBRCxHQUFBO0FBQ2YsUUFBQSxRQUFBO0FBQUEsSUFBQSxRQUFBLEdBQVcsSUFBSSxDQUFDLE9BQUwsQ0FBYSxpQkFBYixDQUErQixDQUFDLGNBQWhDLENBQUEsQ0FBWCxDQUFBO0FBQUEsSUFDQSxRQUFRLENBQUMsU0FBVCxDQUFtQixNQUFuQixDQURBLENBQUE7QUFBQSxJQUVBLFFBQVEsQ0FBQyxTQUFULENBQW1CLElBQUMsQ0FBQSxZQUFELENBQUEsQ0FBbkIsQ0FGQSxDQUFBO0FBQUEsSUFHQSxRQUFRLENBQUMsR0FBVCxDQUFhLElBQWIsRUFBbUIsSUFBbkIsQ0FIQSxDQUFBO0FBQUEsSUFJQSxRQUFRLENBQUMsR0FBVCxDQUFhLFdBQWIsRUFBMEIsSUFBMUIsQ0FKQSxDQUFBO0FBS0EsV0FBTyxRQUFQLENBTmU7RUFBQSxDQTFjaEIsQ0FBQTs7QUFBQSxzQkFtZEEsTUFBQSxHQUFRLFNBQUEsR0FBQTtBQUNQLFdBQU8sSUFBUCxDQURPO0VBQUEsQ0FuZFIsQ0FBQTs7QUFBQSxzQkF1ZEEsYUFBQSxHQUFlLFNBQUMsT0FBRCxHQUFBO0FBQ2QsSUFBQSxJQUFDLENBQUEsUUFBRCxHQUFZLEtBQVosQ0FBQTtBQUFBLElBQ0EsSUFBQyxDQUFBLFFBQUQsR0FBWSxJQURaLENBQUE7QUFFQSxJQUFBLElBQUcsT0FBSDtBQUNDLE1BQUEsSUFBQyxDQUFBLEVBQUUsQ0FBQyxLQUFKLENBQUEsQ0FBQSxDQUFBO0FBQUEsTUFDQSxJQUFDLENBQUEsRUFBRSxDQUFDLE9BQUosQ0FBQSxDQURBLENBREQ7S0FGQTtBQUtBLFdBQU8sSUFBUCxDQU5jO0VBQUEsQ0F2ZGYsQ0FBQTs7QUFBQSxzQkFnZUEsTUFBQSxHQUFRLFNBQUMsRUFBRCxFQUFLLFFBQUwsR0FBQTtBQUNQLFFBQUEsU0FBQTtBQUFBLElBQUEsSUFBa0IsSUFBQyxDQUFBLFFBQW5CO0FBQUEsTUFBQSxFQUFBLEdBQUssSUFBQyxDQUFBLFFBQU4sQ0FBQTtLQUFBO0FBQ0EsSUFBQSxJQUFHLElBQUMsQ0FBQSxRQUFKO0FBQWtCLFlBQUEsQ0FBbEI7S0FEQTtBQUdBLElBQUEsSUFBRyxRQUFBLEtBQVksU0FBZjtBQUNDLE1BQUEsSUFBQyxDQUFBLEVBQUUsQ0FBQyxRQUFKLENBQWEsQ0FBQSxDQUFFLEVBQUYsQ0FBYixDQUFBLENBQUE7QUFBQSxNQUNBLElBQUMsQ0FBQSxRQUFELEdBQVksSUFBQyxDQUFBLEVBQUUsQ0FBQyxTQUFKLENBQUEsQ0FEWixDQUREO0tBQUEsTUFBQTtBQUlDLE1BQUEsSUFBRyxFQUFBLElBQU8sQ0FBQSxJQUFFLENBQUEsUUFBWjtBQUEwQixRQUFBLElBQUMsQ0FBQSxXQUFELENBQWEsRUFBYixFQUFpQixRQUFqQixDQUFBLENBQTFCO09BSkQ7S0FIQTtBQUFBLElBVUEsSUFBQyxDQUFBLFlBQUQsQ0FBQSxDQVZBLENBQUE7QUFXQSxJQUFBLElBQUcsQ0FBQSxJQUFFLENBQUEsa0JBQUw7QUFBNkIsWUFBVSxJQUFBLEtBQUEsQ0FBTyxlQUFBLEdBQWMsSUFBZCxHQUFpQix3Q0FBeEIsQ0FBVixDQUE3QjtLQVhBO0FBQUEsSUFZQSxJQUFDLENBQUEsV0FBRCxDQUFhLGNBQWIsRUFBNkIsSUFBN0IsQ0FaQSxDQUFBO0FBQUEsSUFlQSxTQUFBLEdBQVksSUFBQyxDQUFBLFVBQUQsQ0FBWSw4QkFBWixDQWZaLENBQUE7QUFnQkEsSUFBQSxJQUEyQixTQUEzQjtBQUFBLE1BQUEsSUFBQyxDQUFBLFNBQUQsR0FBYSxTQUFiLENBQUE7S0FoQkE7QUFBQSxJQWtCQSxJQUFDLENBQUEsYUFBRCxDQUFBLENBbEJBLENBQUE7QUFtQkEsV0FBTyxJQUFQLENBcEJPO0VBQUEsQ0FoZVIsQ0FBQTs7QUFBQSxzQkF1ZkEsT0FBQSxHQUFTLFNBQUMsTUFBRCxHQUFBO0FBQ1IsSUFBQSxNQUFBLEdBQVMsTUFBQSxJQUFVLENBQUEsQ0FBRSxJQUFDLENBQUEsRUFBSCxDQUFuQixDQUFBO0FBQ0EsSUFBQSxJQUE4QixNQUE5QjtBQUFBLE1BQUEsSUFBQyxDQUFBLE1BQUQsQ0FBUSxNQUFSLEVBQWdCLFNBQWhCLENBQUEsQ0FBQTtLQURBO0FBRUEsV0FBTyxJQUFQLENBSFE7RUFBQSxDQXZmVCxDQUFBOztBQUFBLHNCQTZmQSxNQUFBLEdBQVEsU0FBQSxHQUFBO0FBQ1AsSUFBQSxJQUFHLENBQUEsSUFBRSxDQUFBLFFBQUw7QUFBbUIsWUFBQSxDQUFuQjtLQUFBO0FBQ0EsSUFBQSxJQUFHLElBQUMsQ0FBQSxTQUFKO0FBQW1CLE1BQUEsSUFBQyxDQUFBLFNBQVMsQ0FBQyxLQUFYLENBQUEsQ0FBQSxDQUFuQjtLQUFBLE1BQUE7QUFBMkMsTUFBQSxJQUFDLENBQUEsRUFBRSxDQUFDLEtBQUosQ0FBQSxDQUFBLENBQTNDO0tBREE7QUFBQSxJQUVBLElBQUMsQ0FBQSxhQUFELENBQUEsQ0FGQSxDQUFBO0FBR0EsV0FBTyxJQUFQLENBSk87RUFBQSxDQTdmUixDQUFBOztBQUFBLHNCQW9nQkEsYUFBQSxHQUFlLFNBQUEsR0FBQTtBQUVkLElBQUEsSUFBQyxDQUFBLFNBQUQsR0FBYSxJQUFiLENBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxJQUFELENBQU0sUUFBTixFQUFnQixJQUFoQixFQUFzQixJQUFDLENBQUEsRUFBdkIsQ0FEQSxDQUFBO0FBQUEsSUFJQSxJQUFDLENBQUEsUUFBRCxDQUFBLENBSkEsQ0FBQTtBQUFBLElBS0EsSUFBQyxDQUFBLFdBQUQsQ0FBYSxVQUFiLEVBQXlCLElBQXpCLENBTEEsQ0FBQTtBQUFBLElBUUEsSUFBQyxDQUFBLFdBQUQsQ0FBYSxrQkFBYixDQUFnQyxDQUFDLElBQWpDLENBQXNDLENBQUEsU0FBQSxLQUFBLEdBQUE7YUFBQSxTQUFDLEVBQUQsR0FBQTtBQUNyQyxRQUFBLEtBQUssQ0FBQSxFQUFFLENBQUMsWUFBSCxDQUFnQixnQkFBaEIsQ0FBQSxDQUFMLEdBQTBDLEVBQTFDLENBQUE7QUFBQSxRQUNBLEVBQUUsQ0FBQyxlQUFILENBQW1CLGdCQUFuQixDQURBLENBRHFDO01BQUEsRUFBQTtJQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBdEMsQ0FSQSxDQUFBO0FBQUEsSUFjQSxJQUFDLENBQUEsUUFBRCxHQUFZLElBZFosQ0FBQTtBQUFBLElBZUEsSUFBQyxDQUFBLFNBQUQsR0FBYSxLQWZiLENBQUE7QUFBQSxJQWtCQSxJQUFDLENBQUEsaUJBQUQsR0FBcUIsS0FsQnJCLENBQUE7QUFBQSxJQW1CQSxJQUFDLENBQUEsV0FBRCxDQUFBLENBbkJBLENBQUE7QUFvQkEsSUFBQSxJQUFHLENBQUEsSUFBRSxDQUFBLGlCQUFMO0FBQTRCLFlBQVUsSUFBQSxLQUFBLENBQU8sZUFBQSxHQUFjLElBQWQsR0FBaUIsdUNBQXhCLENBQVYsQ0FBNUI7S0FwQkE7QUFBQSxJQXFCQSxJQUFDLENBQUEsV0FBRCxDQUFhLGFBQWIsRUFBNEIsSUFBNUIsQ0FyQkEsQ0FBQTtBQUFBLElBdUJBLElBQUMsQ0FBQSxXQUFELEdBQWUsSUF2QmYsQ0FBQTtBQUFBLElBMEJBLElBQUMsQ0FBQSxJQUFELENBQU0sVUFBTixFQUFtQixJQUFuQixFQUF5QixJQUFDLENBQUEsWUFBRCxDQUFBLENBQXpCLENBMUJBLENBRmM7RUFBQSxDQXBnQmYsQ0FBQTs7QUFBQSxzQkFvaUJBLFlBQUEsR0FBYyxTQUFBLEdBQUE7QUFDYixRQUFBLEVBQUE7QUFBQSxJQUFBLElBQUMsQ0FBQSxrQkFBRCxHQUFzQixJQUF0QixDQUFBO0FBQUEsSUFFQSxFQUFBLEdBQUssSUFBQyxDQUFBLEVBRk4sQ0FBQTtBQUFBLElBR0EsRUFBRSxDQUFDLFVBQUgsQ0FBYyxJQUFDLENBQUEsT0FBZixDQUhBLENBQUE7QUFBQSxJQU1BLEVBQUUsQ0FBQyxHQUFILENBQU8sV0FBUCxFQUFvQixJQUFDLENBQUEsSUFBckIsQ0FOQSxDQUFBO0FBQUEsSUFPQSxFQUFFLENBQUMsS0FBSCxDQUFTLFdBQVQsRUFBc0IsSUFBdEIsQ0FQQSxDQUFBO0FBUUEsSUFBQSxJQUFzQixDQUFBLElBQUUsQ0FBQSxjQUF4QjtBQUFBLE1BQUEsRUFBRSxDQUFDLEdBQUgsQ0FBTyxJQUFQLEVBQWEsSUFBQyxDQUFBLEVBQWQsQ0FBQSxDQUFBO0tBUkE7QUFTQSxJQUFBLElBQTBCLENBQUEsSUFBRSxDQUFBLElBQTVCO0FBQUEsTUFBQSxFQUFFLENBQUMsR0FBSCxDQUFPLE1BQVAsRUFBZSxJQUFDLENBQUEsSUFBaEIsQ0FBQSxDQUFBO0tBVEE7QUFZQSxJQUFBLElBQXNCLElBQUMsQ0FBQSxHQUF2QjtBQUFBLE1BQUEsRUFBRSxDQUFDLFFBQUgsQ0FBWSxJQUFDLENBQUEsR0FBYixDQUFBLENBQUE7S0FaQTtBQWFBLElBQUEsSUFBMEIsSUFBQyxDQUFBLE9BQTNCO0FBQUEsTUFBQSxFQUFFLENBQUMsUUFBSCxDQUFZLElBQUMsQ0FBQSxPQUFiLENBQUEsQ0FBQTtLQWJBO0FBY0EsSUFBQSxJQUErQixJQUFDLENBQUEsWUFBaEM7QUFBQSxNQUFBLEVBQUUsQ0FBQyxRQUFILENBQVksSUFBQyxDQUFBLFlBQWIsQ0FBQSxDQUFBO0tBZEE7QUFpQkEsSUFBQSxJQUEwQixJQUFDLENBQUEsTUFBRCxLQUFhLElBQXZDO0FBQUEsTUFBQSxFQUFFLENBQUMsU0FBSCxDQUFhLElBQUMsQ0FBQSxNQUFkLENBQUEsQ0FBQTtLQWpCQTtBQWtCQSxJQUFBLElBQWlDLElBQUMsQ0FBQSxLQUFELEtBQVksSUFBN0M7QUFBQSxNQUFBLEVBQUUsQ0FBQyxRQUFILENBQVksT0FBWixFQUFxQixJQUFDLENBQUEsS0FBdEIsQ0FBQSxDQUFBO0tBbEJBO0FBbUJBLElBQUEsSUFBbUMsSUFBQyxDQUFBLE1BQUQsS0FBYSxJQUFoRDtBQUFBLE1BQUEsRUFBRSxDQUFDLFFBQUgsQ0FBWSxRQUFaLEVBQXNCLElBQUMsQ0FBQSxNQUF2QixDQUFBLENBQUE7S0FuQkE7QUFvQkEsSUFBQSxJQUE2QixJQUFDLENBQUEsR0FBRCxLQUFVLElBQXZDO0FBQUEsTUFBQSxFQUFFLENBQUMsUUFBSCxDQUFZLEtBQVosRUFBbUIsSUFBQyxDQUFBLEdBQXBCLENBQUEsQ0FBQTtLQXBCQTtBQXFCQSxJQUFBLElBQW1DLElBQUMsQ0FBQSxNQUFELEtBQWEsSUFBaEQ7QUFBQSxNQUFBLEVBQUUsQ0FBQyxRQUFILENBQVksUUFBWixFQUFzQixJQUFDLENBQUEsTUFBdkIsQ0FBQSxDQUFBO0tBckJBO0FBc0JBLElBQUEsSUFBK0IsSUFBQyxDQUFBLElBQUQsS0FBVyxJQUExQztBQUFBLE1BQUEsRUFBRSxDQUFDLFFBQUgsQ0FBWSxNQUFaLEVBQW9CLElBQUMsQ0FBQSxJQUFyQixDQUFBLENBQUE7S0F0QkE7QUF1QkEsSUFBQSxJQUFpQyxJQUFDLENBQUEsS0FBRCxLQUFZLElBQTdDO0FBQUEsTUFBQSxFQUFFLENBQUMsUUFBSCxDQUFZLE9BQVosRUFBcUIsSUFBQyxDQUFBLEtBQXRCLENBQUEsQ0FBQTtLQXZCQTtBQXdCQSxJQUFBLElBQW1DLElBQUMsQ0FBQSxNQUFELEtBQWEsSUFBaEQ7QUFBQSxNQUFBLEVBQUUsQ0FBQyxRQUFILENBQVksUUFBWixFQUFzQixJQUFDLENBQUEsTUFBdkIsQ0FBQSxDQUFBO0tBeEJBO0FBeUJBLElBQUEsSUFBcUMsSUFBQyxDQUFBLE9BQUQsS0FBYyxJQUFuRDtBQUFBLE1BQUEsRUFBRSxDQUFDLFFBQUgsQ0FBWSxTQUFaLEVBQXVCLElBQUMsQ0FBQSxPQUF4QixDQUFBLENBQUE7S0F6QkE7QUEwQkEsSUFBQSxJQUFtQyxJQUFDLENBQUEsTUFBRCxLQUFhLElBQWhEO0FBQUEsTUFBQSxFQUFFLENBQUMsUUFBSCxDQUFZLFFBQVosRUFBc0IsSUFBQyxDQUFBLE1BQXZCLENBQUEsQ0FBQTtLQTFCQTtBQUFBLElBNkJBLElBQUMsQ0FBQSxZQUFZLENBQUMsWUFBZCxDQUEyQixJQUEzQixDQTdCQSxDQURhO0VBQUEsQ0FwaUJkLENBQUE7O0FBQUEsc0JBc2tCQSxRQUFBLEdBQVUsU0FBQSxHQUFBO0FBQ1QsSUFBQSxJQUFHLElBQUMsQ0FBQSxRQUFKO0FBQ0MsTUFBQSxJQUFDLENBQUEsV0FBRCxDQUFBLENBQWMsQ0FBQyxNQUFmLENBQUEsQ0FBQSxDQUREO0tBQUEsTUFFSyxJQUFHLElBQUMsQ0FBQSxJQUFKO0FBQ0osTUFBQSxJQUFDLENBQUEsWUFBRCxDQUFBLENBQWUsQ0FBQyxHQUFoQixDQUFvQixNQUFwQixFQUE0QixJQUFDLENBQUEsSUFBN0IsQ0FBQSxDQURJO0tBRkw7QUFBQSxJQU1BLElBQUMsQ0FBQSxXQUFELENBQWEsa0JBQWIsQ0FBZ0MsQ0FBQyxJQUFqQyxDQUFzQyxDQUFBLFNBQUEsS0FBQSxHQUFBO2FBQUEsU0FBQyxFQUFELEdBQUE7QUFDckMsUUFBQSxLQUFLLENBQUEsRUFBRSxDQUFDLFlBQUgsQ0FBZ0IsZ0JBQWhCLENBQUEsQ0FBTCxHQUEwQyxFQUExQyxDQUFBO0FBQUEsUUFDQSxFQUFFLENBQUMsZUFBSCxDQUFtQixnQkFBbkIsQ0FEQSxDQURxQztNQUFBLEVBQUE7SUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQXRDLENBTkEsQ0FEUztFQUFBLENBdGtCVixDQUFBOztBQUFBLHNCQW9sQkEsV0FBQSxHQUFhLFNBQUEsR0FBQTtBQUNaLElBQUEsSUFBQyxDQUFBLGlCQUFELEdBQXFCLElBQXJCLENBQUE7QUFBQSxJQUdBLElBQUMsQ0FBQSxXQUFELENBQWEsZUFBYixDQUE2QixDQUFDLElBQTlCLENBQW1DLENBQUEsU0FBQSxLQUFBLEdBQUE7YUFBQSxTQUFDLEVBQUQsR0FBQTtBQUNsQyxZQUFBLDhCQUFBO0FBQUEsUUFBQSxNQUFBLEdBQVMsRUFBRSxDQUFDLFlBQUgsQ0FBZ0IsYUFBaEIsQ0FBOEIsQ0FBQyxLQUEvQixDQUFxQyxHQUFyQyxDQUFULENBQUE7QUFDQSxhQUFBLDZDQUFBOzZCQUFBO0FBQ0MsVUFBQSxLQUFBLEdBQVEsS0FBSyxDQUFDLEtBQU4sQ0FBWSxHQUFaLEVBQWlCLENBQWpCLENBQVIsQ0FBQTtBQUNBLFVBQUEsSUFBRyxDQUFBLEtBQU0sQ0FBQSxLQUFNLENBQUEsQ0FBQSxDQUFOLENBQVQ7QUFDQyxrQkFBVSxJQUFBLEtBQUEsQ0FBTyx3Q0FBQSxHQUF1QyxLQUFDLENBQUEsSUFBeEMsR0FBOEMsMEJBQTlDLEdBQXVFLEtBQU0sQ0FBQSxDQUFBLENBQTdFLEdBQWlGLGVBQWpGLEdBQStGLEtBQU0sQ0FBQSxDQUFBLENBQXJHLEdBQXlHLEdBQWhILENBQVYsQ0FERDtXQURBO0FBQUEsVUFHQSxFQUFFLENBQUMsRUFBSCxDQUFNLEtBQU0sQ0FBQSxDQUFBLENBQVosRUFBZ0IsS0FBQyxDQUFBLEtBQUQsQ0FBTyxLQUFNLENBQUEsQ0FBQSxDQUFiLENBQWhCLENBSEEsQ0FERDtBQUFBLFNBREE7QUFBQSxRQU1BLEVBQUUsQ0FBQyxlQUFILENBQW1CLGFBQW5CLENBTkEsQ0FEa0M7TUFBQSxFQUFBO0lBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFuQyxDQUhBLENBQUE7QUFBQSxJQWNBLElBQUMsQ0FBQSxZQUFZLENBQUMsV0FBZCxDQUEwQixJQUExQixDQWRBLENBRFk7RUFBQSxDQXBsQmIsQ0FBQTs7QUFBQSxzQkE0bUJBLFVBQUEsR0FBWSxTQUFDLE9BQUQsR0FBQTtBQUNYLElBQUEsSUFBRyxPQUFIO0FBQWdCLE1BQUEsSUFBQyxDQUFBLElBQUQsQ0FBQSxDQUFBLENBQWhCO0tBQUEsTUFBQTtBQUE2QixNQUFBLElBQUMsQ0FBQSxJQUFELENBQUEsQ0FBQSxDQUE3QjtLQURXO0VBQUEsQ0E1bUJaLENBQUE7O0FBQUEsc0JBaW5CQSxTQUFBLEdBQVcsU0FBQSxHQUFBO0FBQ1YsV0FBTyxJQUFDLENBQUEsT0FBUixDQURVO0VBQUEsQ0FqbkJYLENBQUE7O0FBQUEsc0JBcW5CQSxXQUFBLEdBQWEsU0FBQyxHQUFELEdBQUE7QUFDWixRQUFBLFdBQUE7QUFBQSxJQUFBLEtBQUEsR0FBUSxRQUFRLENBQUMsT0FBVCxDQUFBLENBQVIsQ0FBQTtBQUFBLElBQ0EsSUFBQSxHQUFPLElBQUMsQ0FBQSxFQUFFLENBQUMsT0FBSixDQUFBLENBRFAsQ0FBQTtBQUFBLElBRUEsR0FBRyxDQUFDLENBQUosR0FBUSxJQUFJLENBQUMsR0FBTCxDQUFTLEVBQVQsRUFBYSxJQUFJLENBQUMsR0FBTCxDQUFTLEdBQUcsQ0FBQyxDQUFiLEVBQWdCLEtBQUssQ0FBQyxDQUFOLEdBQVEsSUFBSSxDQUFDLENBQWIsR0FBZSxFQUEvQixDQUFiLENBRlIsQ0FBQTtBQUFBLElBSUEsSUFBQyxDQUFBLEdBQUQsR0FBTyxHQUFHLENBQUMsQ0FKWCxDQUFBO0FBQUEsSUFLQSxJQUFDLENBQUEsSUFBRCxHQUFRLEdBQUcsQ0FBQyxDQUxaLENBQUE7QUFBQSxJQU1BLElBQUMsQ0FBQSxFQUFFLENBQUMsUUFBSixDQUFhLEtBQWIsRUFBb0IsSUFBQyxDQUFBLEdBQXJCLENBTkEsQ0FBQTtBQUFBLElBT0EsSUFBQyxDQUFBLEVBQUUsQ0FBQyxRQUFKLENBQWEsTUFBYixFQUFxQixJQUFDLENBQUEsSUFBdEIsQ0FQQSxDQURZO0VBQUEsQ0FybkJiLENBQUE7O0FBQUEsc0JBaW9CQSxJQUFBLEdBQU0sU0FBQSxHQUFBO0FBQ0wsSUFBQSxJQUFHLENBQUEsSUFBRSxDQUFBLFFBQUw7QUFBbUIsTUFBQSxJQUFDLENBQUEsTUFBRCxDQUFBLENBQUEsQ0FBbkI7S0FBQTtBQUNBLElBQUEsSUFBRyxJQUFDLENBQUEsT0FBSjtBQUFpQixZQUFBLENBQWpCO0tBREE7QUFBQSxJQUVBLElBQUMsQ0FBQSxJQUFELENBQU0sTUFBTixFQUFjLElBQWQsQ0FGQSxDQUFBO0FBQUEsSUFHQSxJQUFDLENBQUEsTUFBRCxDQUFBLENBSEEsQ0FBQTtBQUFBLElBSUEsSUFBQyxDQUFBLFdBQUQsQ0FBYSxJQUFiLENBSkEsQ0FBQTtBQUFBLElBS0EsSUFBQyxDQUFBLElBQUQsQ0FBTSxPQUFOLEVBQWUsSUFBZixDQUxBLENBQUE7V0FNQSxLQVBLO0VBQUEsQ0Fqb0JOLENBQUE7O0FBQUEsc0JBMm9CQSxNQUFBLEdBQVEsU0FBQyxHQUFELEdBQUE7QUFDUCxJQUFBLElBQUMsQ0FBQSxJQUFELENBQUEsQ0FBQSxDQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsV0FBRCxDQUFhLEdBQWIsQ0FEQSxDQURPO0VBQUEsQ0Ezb0JSLENBQUE7O0FBQUEsc0JBaXBCQSxNQUFBLEdBQVEsU0FBQSxHQUFBO0FBQ1AsUUFBQSxFQUFBO0FBQUEsSUFBQSxFQUFBLEdBQUssSUFBQyxDQUFBLEVBQU4sQ0FBQTtBQUNBLElBQUEsSUFBNkIsSUFBQyxDQUFBLEdBQUQsS0FBVSxJQUF2QztBQUFBLE1BQUEsRUFBRSxDQUFDLFFBQUgsQ0FBWSxLQUFaLEVBQW1CLElBQUMsQ0FBQSxHQUFwQixDQUFBLENBQUE7S0FEQTtBQUVBLElBQUEsSUFBbUMsSUFBQyxDQUFBLE1BQUQsS0FBYSxJQUFoRDtBQUFBLE1BQUEsRUFBRSxDQUFDLFFBQUgsQ0FBWSxRQUFaLEVBQXNCLElBQUMsQ0FBQSxNQUF2QixDQUFBLENBQUE7S0FGQTtBQUdBLElBQUEsSUFBK0IsSUFBQyxDQUFBLElBQUQsS0FBVyxJQUExQztBQUFBLE1BQUEsRUFBRSxDQUFDLFFBQUgsQ0FBWSxNQUFaLEVBQW9CLElBQUMsQ0FBQSxJQUFyQixDQUFBLENBQUE7S0FIQTtBQUlBLElBQUEsSUFBaUMsSUFBQyxDQUFBLEtBQUQsS0FBWSxJQUE3QztBQUFBLE1BQUEsRUFBRSxDQUFDLFFBQUgsQ0FBWSxPQUFaLEVBQXFCLElBQUMsQ0FBQSxLQUF0QixDQUFBLENBQUE7S0FKQTtBQUFBLElBS0EsRUFBRSxDQUFDLElBQUgsQ0FBQSxDQUxBLENBQUE7QUFBQSxJQU1BLElBQUMsQ0FBQSxPQUFELEdBQVcsSUFOWCxDQUFBO0FBT0EsSUFBQSxJQUFHLENBQUMsQ0FBQSxJQUFFLENBQUEsR0FBRixJQUFTLENBQUEsSUFBRSxDQUFBLElBQVosQ0FBQSxJQUFzQixJQUFDLENBQUEsVUFBMUI7QUFBMEMsTUFBQSxJQUFDLENBQUEsTUFBRCxDQUFBLENBQUEsQ0FBMUM7S0FSTztFQUFBLENBanBCUixDQUFBOztBQUFBLHNCQTZwQkEsV0FBQSxHQUFhLFNBQUMsTUFBRCxHQUFBO0FBQ1osSUFBQSxJQUFDLENBQUEsSUFBRCxDQUFNLGFBQU4sRUFBcUIsTUFBckIsQ0FBQSxDQURZO0VBQUEsQ0E3cEJiLENBQUE7O0FBQUEsc0JBa3FCQSxJQUFBLEdBQU0sU0FBQSxHQUFBO0FBQ0wsSUFBQSxJQUFHLENBQUEsSUFBRSxDQUFBLE9BQUw7QUFBa0IsWUFBQSxDQUFsQjtLQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsSUFBRCxDQUFNLE1BQU4sRUFBYyxJQUFkLENBREEsQ0FBQTtBQUFBLElBRUEsSUFBQyxDQUFBLE1BQUQsQ0FBQSxDQUZBLENBQUE7QUFBQSxJQUdBLElBQUMsQ0FBQSxJQUFELENBQU0sT0FBTixFQUFlLElBQWYsQ0FIQSxDQUFBO1dBSUEsS0FMSztFQUFBLENBbHFCTixDQUFBOztBQUFBLHNCQTBxQkEsTUFBQSxHQUFRLFNBQUEsR0FBQTtBQUNQLElBQUEsSUFBQyxDQUFBLE9BQUQsR0FBVyxLQUFYLENBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxFQUFFLENBQUMsSUFBSixDQUFBLENBREEsQ0FETztFQUFBLENBMXFCUixDQUFBOztBQUFBLHNCQWdyQkEsTUFBQSxHQUFRLFNBQUEsR0FBQTtBQUNQLElBQUEsSUFBRyxDQUFBLElBQUUsQ0FBQSxJQUFMO0FBQ0MsTUFBQSxJQUFDLENBQUEsRUFBRSxDQUFDLFFBQUosQ0FBYSxNQUFiLEVBQXFCLENBQUMsSUFBQyxDQUFBLFFBQVEsQ0FBQyxRQUFWLENBQUEsQ0FBQSxHQUF1QixJQUFDLENBQUEsRUFBRSxDQUFDLFFBQUosQ0FBQSxDQUF4QixDQUFBLEdBQTBDLENBQS9ELENBQUEsQ0FERDtLQUFBO0FBRUEsSUFBQSxJQUFHLENBQUEsSUFBRSxDQUFBLEdBQUw7QUFDQyxNQUFBLElBQUMsQ0FBQSxFQUFFLENBQUMsUUFBSixDQUFhLEtBQWIsRUFBb0IsQ0FBQyxJQUFDLENBQUEsUUFBUSxDQUFDLFNBQVYsQ0FBQSxDQUFBLEdBQXdCLElBQUMsQ0FBQSxFQUFFLENBQUMsU0FBSixDQUFBLENBQXpCLENBQUEsR0FBNEMsQ0FBaEUsQ0FBQSxDQUREO0tBSE87RUFBQSxDQWhyQlIsQ0FBQTs7QUFBQSxzQkF3ckJBLE9BQUEsR0FBUyxTQUFDLEtBQUQsRUFBUSxNQUFSLEdBQUE7QUFDUixJQUFBLElBQUcsSUFBSSxDQUFDLFFBQUwsQ0FBYyxLQUFkLENBQUg7QUFDQyxNQUFBLE1BQUEsR0FBUyxLQUFLLENBQUMsTUFBZixDQUFBO0FBQUEsTUFDQSxLQUFBLEdBQVEsS0FBSyxDQUFDLEtBRGQsQ0FERDtLQUFBO0FBR0EsSUFBQSxJQUFHLE1BQUEsS0FBWSxNQUFaLElBQTBCLE1BQUEsS0FBWSxJQUF6QztBQUNDLE1BQUEsSUFBQyxDQUFBLE1BQUQsR0FBVSxNQUFWLENBQUE7QUFBQSxNQUNBLElBQUMsQ0FBQSxFQUFFLENBQUMsUUFBSixDQUFhLFFBQWIsRUFBdUIsTUFBdkIsQ0FEQSxDQUREO0tBSEE7QUFNQSxJQUFBLElBQUcsS0FBQSxLQUFXLE1BQVgsSUFBeUIsS0FBQSxLQUFXLElBQXZDO0FBQ0MsTUFBQSxJQUFDLENBQUEsS0FBRCxHQUFTLEtBQVQsQ0FBQTtBQUFBLE1BQ0EsSUFBQyxDQUFBLEVBQUUsQ0FBQyxRQUFKLENBQWEsT0FBYixFQUFzQixLQUF0QixDQURBLENBREQ7S0FOQTtBQUFBLElBU0EsSUFBQyxDQUFBLElBQUQsQ0FBTSxRQUFOLEVBQWdCLElBQWhCLENBVEEsQ0FEUTtFQUFBLENBeHJCVCxDQUFBOztBQUFBLHNCQXNzQkEsT0FBQSxHQUFTLFNBQUEsR0FBQTtBQUNSLFVBQUEsQ0FBQTtXQUNBO0FBQUEsTUFBQSxLQUFBLEVBQU8sSUFBQyxDQUFBLEVBQUUsQ0FBQyxRQUFKLENBQUEsQ0FBUDtBQUFBLE1BQ0EsTUFBQSxFQUFRLElBQUMsQ0FBQSxFQUFFLENBQUMsU0FBSixDQUFBLENBRFI7TUFGUTtFQUFBLENBdHNCVCxDQUFBOztBQUFBLHNCQWl0QkEsYUFBQSxHQUFlLFNBQUEsR0FBQTtBQUNkLElBQUEsSUFBQyxDQUFBLElBQUQsQ0FBTSxTQUFOLEVBQWlCLElBQWpCLENBQUEsQ0FBQTtBQUNBLElBQUEsSUFBc0MsSUFBQyxDQUFBLFNBQXZDO0FBQUEsTUFBQSxJQUFDLENBQUEsU0FBUyxDQUFDLGVBQVgsQ0FBMkIsSUFBQyxDQUFBLElBQTVCLENBQUEsQ0FBQTtLQURBO0FBRUEsSUFBQSxJQUFvQyxJQUFDLENBQUEsWUFBckM7QUFBQSxNQUFBLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBZixDQUEwQixJQUExQixDQUFBLENBQUE7S0FGQTtBQUFBLElBR0EsSUFBSSxDQUFDLFlBQVksQ0FBQyxVQUFsQixDQUE2QixJQUE3QixDQUhBLENBRGM7RUFBQSxDQWp0QmYsQ0FBQTs7QUFBQSxzQkF5dEJBLFNBQUEsR0FBVyxTQUFBLEdBQUE7QUFDVixRQUFBLHlCQUFBO0FBQUEsSUFBQSxJQUF1QixnRUFBdkI7QUFBQSxNQUFBLElBQUMsQ0FBQSxRQUFRLENBQUMsT0FBVixDQUFBLENBQUEsQ0FBQTtLQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsRUFBRSxDQUFDLFNBQUosQ0FBYyxXQUFkLENBREEsQ0FBQTtBQUFBLElBRUEsSUFBQyxDQUFBLEVBQUUsQ0FBQyxPQUFKLENBQUEsQ0FGQSxDQUFBO0FBR0E7QUFBQSxTQUFBLGFBQUE7MkJBQUE7QUFBaUMsTUFBQSxJQUFDLENBQUEsZUFBRCxDQUFpQixJQUFqQixDQUFBLENBQWpDO0FBQUEsS0FKVTtFQUFBLENBenRCWCxDQUFBOztBQUFBLHNCQWl1QkEsWUFBQSxHQUFjLFNBQUEsR0FBQTtBQUNiLElBQUEsSUFBQyxDQUFBLElBQUQsQ0FBTSxXQUFOLEVBQW1CLElBQW5CLENBQUEsQ0FEYTtFQUFBLENBanVCZCxDQUFBOzttQkFBQTs7R0FIdUIsV0FIeEIsQ0FBQTs7QUFBQSxNQTZ1Qk0sQ0FBQyxPQUFQLEdBQWlCLFNBN3VCakIsQ0FBQTs7OztBQ0FBLElBQUEsNEJBQUE7RUFBQTtpU0FBQTs7QUFBQSxVQUFBLEdBQWEsT0FBQSxDQUFRLGdCQUFSLENBQWIsQ0FBQTs7QUFBQTtBQUtDLHFDQUFBLENBQUE7O0FBQUEsNkJBQUEsSUFBQSxHQUFNLElBQU4sQ0FBQTs7QUFBQSw2QkFDQSxLQUFBLEdBQU8sSUFEUCxDQUFBOztBQUFBLDZCQUVBLEtBQUEsR0FBTyxJQUZQLENBQUE7O0FBQUEsNkJBR0EsRUFBQSxHQUFJLENBSEosQ0FBQTs7QUFNYSxFQUFBLDBCQUFBLEdBQUE7QUFDWixJQUFBLGdEQUFBLENBQUEsQ0FBQTtBQUFBLElBQ0EsSUFBQyxDQUFBLElBQUQsR0FBUSxFQURSLENBQUE7QUFBQSxJQUVBLElBQUMsQ0FBQSxLQUFELEdBQVMsRUFGVCxDQUFBO0FBQUEsSUFHQSxJQUFDLENBQUEsS0FBRCxHQUFTLEVBSFQsQ0FBQTtBQUlBLFVBQUEsQ0FMWTtFQUFBLENBTmI7O0FBQUEsNkJBY0EsUUFBQSxHQUFVLFNBQUEsR0FBQTtBQUNULElBQUEsSUFBQyxDQUFBLEVBQUQsRUFBQSxDQUFBO0FBQ0EsV0FBTyxHQUFBLEdBQU0sSUFBQyxDQUFBLEVBQWQsQ0FGUztFQUFBLENBZFYsQ0FBQTs7QUFBQSw2QkFtQkEsVUFBQSxHQUFZLFNBQUMsS0FBRCxHQUFBO0FBQ1gsSUFBQSxJQUFBLENBQUEsSUFBMkIsQ0FBQSxLQUFNLENBQUEsS0FBQSxDQUFqQztBQUFBLE1BQUEsSUFBQyxDQUFBLEtBQU0sQ0FBQSxLQUFBLENBQVAsR0FBZ0IsQ0FBaEIsQ0FBQTtLQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsS0FBTSxDQUFBLEtBQUEsQ0FBUCxFQURBLENBQUE7QUFFQSxXQUFPLEtBQUEsR0FBUSxJQUFDLENBQUEsS0FBTSxDQUFBLEtBQUEsQ0FBdEIsQ0FIVztFQUFBLENBbkJaLENBQUE7O0FBQUEsNkJBeUJBLFFBQUEsR0FBVSxTQUFDLEdBQUQsR0FBQTtBQUNULElBQUEsSUFBRyxHQUFHLENBQUMsWUFBUDtBQUF5QixZQUFVLElBQUEsS0FBQSxDQUFPLFlBQUEsR0FBVyxJQUFYLEdBQWlCLFdBQWpCLEdBQTJCLEdBQUcsQ0FBQyxFQUEvQixHQUFtQyxrQkFBMUMsQ0FBVixDQUF6QjtLQUFBO0FBQUEsSUFDQSxHQUFHLENBQUMsWUFBSixHQUFtQixJQURuQixDQUFBO0FBQUEsSUFFQSxJQUFDLENBQUEsSUFBSyxDQUFBLEdBQUcsQ0FBQyxFQUFKLENBQU4sR0FBZ0IsR0FGaEIsQ0FBQTtBQUFBLElBR0EsSUFBQyxDQUFBLEtBQUssQ0FBQyxPQUFQLENBQWUsR0FBZixDQUhBLENBQUE7QUFBQSxJQUlBLEdBQUcsQ0FBQyxFQUFKLENBQU8sVUFBUCxFQUFtQixDQUFBLFNBQUEsS0FBQSxHQUFBO2FBQUEsU0FBQyxHQUFELEdBQUE7QUFDbEIsUUFBQSxLQUFDLENBQUEsS0FBSyxDQUFDLEtBQVAsQ0FBYSxHQUFiLENBQUEsQ0FEa0I7TUFBQSxFQUFBO0lBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFuQixDQUpBLENBQUE7QUFBQSxJQU9BLEdBQUcsQ0FBQyxFQUFKLENBQU8sVUFBUCxFQUFtQixDQUFBLFNBQUEsS0FBQSxHQUFBO2FBQUEsU0FBQyxHQUFELEdBQUE7QUFDbEIsUUFBQSxJQUF1QixDQUFBLEdBQUksQ0FBQyxVQUE1QjtBQUFBLFVBQUEsS0FBQyxDQUFBLEtBQUssQ0FBQyxPQUFQLENBQWUsR0FBZixDQUFBLENBQUE7U0FEa0I7TUFBQSxFQUFBO0lBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFuQixDQVBBLENBQUE7QUFBQSxJQVVBLEdBQUcsQ0FBQyxFQUFKLENBQU8sVUFBUCxFQUFtQixDQUFBLFNBQUEsS0FBQSxHQUFBO2FBQUEsU0FBQyxHQUFELEVBQU0sS0FBTixFQUFhLEtBQWIsR0FBQTtBQUNsQixRQUFBLE1BQUEsQ0FBQSxLQUFRLENBQUEsSUFBSyxDQUFBLEtBQUEsQ0FBYixDQUFBO0FBQUEsUUFDQSxLQUFDLENBQUEsSUFBSyxDQUFBLEtBQUEsQ0FBTixHQUFlLEdBRGYsQ0FEa0I7TUFBQSxFQUFBO0lBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFuQixDQVZBLENBQUE7QUFBQSxJQWNBLElBQUMsQ0FBQSxJQUFELENBQU0sVUFBTixFQUFrQixHQUFsQixDQWRBLENBRFM7RUFBQSxDQXpCVixDQUFBOztBQUFBLDZCQTRDQSxVQUFBLEdBQVksU0FBQyxHQUFELEdBQUE7QUFDWCxJQUFBLElBQUcsSUFBQyxDQUFBLEtBQUssQ0FBQyxRQUFQLENBQWdCLEdBQWhCLENBQUg7QUFDQyxNQUFBLElBQUMsQ0FBQSxLQUFLLENBQUMsS0FBUCxDQUFhLEdBQWIsQ0FBQSxDQUREO0tBQUE7QUFFQSxJQUFBLElBQUcsSUFBQyxDQUFBLElBQUssQ0FBQSxHQUFHLENBQUMsRUFBSixDQUFUO0FBQ0MsTUFBQSxNQUFBLENBQUEsSUFBUSxDQUFBLElBQUssQ0FBQSxHQUFHLENBQUMsRUFBSixDQUFiLENBQUE7QUFBQSxNQUNBLE1BQUEsQ0FBQSxHQUFVLENBQUMsWUFEWCxDQUFBO0FBQUEsTUFFQSxJQUFDLENBQUEsSUFBRCxDQUFNLFlBQU4sRUFBb0IsR0FBcEIsQ0FGQSxDQUREO0tBSFc7RUFBQSxDQTVDWixDQUFBOztBQUFBLDZCQXNEQSxZQUFBLEdBQWMsU0FBQyxHQUFELEdBQUE7QUFDYixJQUFBLElBQUMsQ0FBQSxJQUFELENBQU0sY0FBTixFQUFzQixHQUF0QixDQUFBLENBRGE7RUFBQSxDQXREZCxDQUFBOztBQUFBLDZCQTJEQSxXQUFBLEdBQWEsU0FBQyxHQUFELEdBQUE7QUFDWixJQUFBLElBQUMsQ0FBQSxJQUFELENBQU0sYUFBTixFQUFxQixHQUFyQixDQUFBLENBRFk7RUFBQSxDQTNEYixDQUFBOztBQUFBLDZCQWdFQSxHQUFBLEdBQUssU0FBQyxFQUFELEdBQUE7QUFDSixXQUFPLENBQUksSUFBQyxDQUFBLElBQUssQ0FBQSxFQUFBLENBQVQsR0FBa0IsSUFBQyxDQUFBLElBQUssQ0FBQSxFQUFBLENBQXhCLEdBQWlDLElBQWxDLENBQVAsQ0FESTtFQUFBLENBaEVMLENBQUE7OzBCQUFBOztHQUY4QixXQUgvQixDQUFBOztBQUFBLE1BMEVNLENBQUMsT0FBUCxHQUFpQixnQkExRWpCLENBQUE7Ozs7QUNBQSxJQUFBLGlCQUFBOztBQUFBO2lDQUVDOztBQUFBLDhCQUFBLGFBQUEsR0FBZSx5QkFBZixDQUFBOztBQUFBLDhCQUNBLGVBQUEsR0FBaUIsZUFEakIsQ0FBQTs7QUFBQSw4QkFFQSxjQUFBLEdBQWdCLDZCQUZoQixDQUFBOztBQUFBLDhCQUlBLEVBQUEsR0FBSSxTQUFDLFNBQUQsRUFBWSxRQUFaLEdBQUE7QUFDSCxRQUFBLDJDQUFBO0FBQUEsSUFBQSxJQUFHLFFBQUEsS0FBWSxHQUFmO0FBQ0MsYUFBTyxJQUFQLENBREQ7S0FBQTtBQUdBLElBQUEsSUFBRyxDQUFBLENBQUUsT0FBQSxHQUFVLFFBQVEsQ0FBQyxLQUFULENBQWUsSUFBQyxDQUFBLGFBQWhCLENBQVgsQ0FBSjtBQUNDLGFBQU8sS0FBUCxDQUREO0tBSEE7QUFNQSxJQUFBLElBQUcsT0FBUSxDQUFBLENBQUEsQ0FBWDtBQUNDLE1BQUEsSUFBRyxPQUFRLENBQUEsQ0FBQSxDQUFSLEtBQWMsR0FBakI7QUFDQyxRQUFBLElBQUcsT0FBUSxDQUFBLENBQUEsQ0FBUixLQUFnQixTQUFTLENBQUMsRUFBN0I7QUFBcUMsaUJBQU8sS0FBUCxDQUFyQztTQUREO09BQUEsTUFFSyxJQUFHLE9BQVEsQ0FBQSxDQUFBLENBQVIsS0FBYyxHQUFqQjtBQUNKLFFBQUEsSUFBRyxPQUFRLENBQUEsQ0FBQSxDQUFSLEtBQWdCLFNBQVMsQ0FBQyxJQUE3QjtBQUF1QyxpQkFBTyxLQUFQLENBQXZDO1NBREk7T0FBQSxNQUFBO0FBR0osUUFBQSxJQUFHLENBQUEsU0FBVSxDQUFDLE9BQVYsQ0FBa0IsT0FBUSxDQUFBLENBQUEsQ0FBMUIsQ0FBSjtBQUF1QyxpQkFBTyxLQUFQLENBQXZDO1NBSEk7T0FITjtLQU5BO0FBY0EsSUFBQSxJQUFHLE9BQVEsQ0FBQSxDQUFBLENBQVg7QUFDQztBQUFBLFdBQUEsMkNBQUE7eUJBQUE7QUFDQyxRQUFBLElBQUcsQ0FBQSxDQUFFLFdBQUEsR0FBYyxLQUFLLENBQUMsS0FBTixDQUFZLElBQUMsQ0FBQSxjQUFiLENBQWYsQ0FBSjtBQUNDLGlCQUFPLEtBQVAsQ0FERDtTQUFBO0FBR0EsUUFBQSxJQUFHLFdBQVksQ0FBQSxDQUFBLENBQVosS0FBa0IsTUFBckI7QUFDQyxVQUFBLElBQUcsQ0FBQSxTQUFXLENBQUEsV0FBWSxDQUFBLENBQUEsQ0FBWixDQUFkO0FBQW1DLG1CQUFPLEtBQVAsQ0FBbkM7V0FERDtTQUFBLE1BQUE7QUFHQyxVQUFBLElBQUcsV0FBWSxDQUFBLENBQUEsQ0FBRSxDQUFDLEtBQWYsQ0FBcUIsT0FBckIsQ0FBSDtBQUNDLFlBQUEsV0FBWSxDQUFBLENBQUEsQ0FBWixHQUFpQixRQUFBLENBQVMsV0FBWSxDQUFBLENBQUEsQ0FBckIsRUFBeUIsRUFBekIsQ0FBakIsQ0FERDtXQUFBLE1BRUssSUFBRyxXQUFZLENBQUEsQ0FBQSxDQUFFLENBQUMsS0FBZixDQUFxQixZQUFyQixDQUFIO0FBQ0osWUFBQSxXQUFZLENBQUEsQ0FBQSxDQUFaLEdBQWlCLFVBQUEsQ0FBVyxXQUFZLENBQUEsQ0FBQSxDQUF2QixDQUFqQixDQURJO1dBRkw7QUFLQSxVQUFBLElBQUcsU0FBVSxDQUFBLFdBQVksQ0FBQSxDQUFBLENBQVosQ0FBVixLQUErQixXQUFZLENBQUEsQ0FBQSxDQUE5QztBQUFzRCxtQkFBTyxLQUFQLENBQXREO1dBUkQ7U0FKRDtBQUFBLE9BREQ7S0FkQTtBQTRCQSxXQUFPLElBQVAsQ0E3Qkc7RUFBQSxDQUpKLENBQUE7O0FBQUEsOEJBb0NBLFdBQUEsR0FBYSxTQUFDLFNBQUQsRUFBWSxRQUFaLEdBQUE7QUFDWixJQUFBLFNBQUEsR0FBWSxTQUFTLENBQUMsU0FBVixDQUFBLENBQVosQ0FBQTtBQUNBLFdBQU0sU0FBTixHQUFBO0FBQ0MsTUFBQSxJQUFHLFNBQVMsQ0FBQyxFQUFWLENBQWEsUUFBYixDQUFIO0FBQStCLGNBQS9CO09BQUE7QUFBQSxNQUNBLFNBQUEsR0FBWSxTQUFTLENBQUMsU0FBVixDQUFBLENBRFosQ0FERDtJQUFBLENBREE7QUFJQSxXQUFPLFNBQVAsQ0FMWTtFQUFBLENBcENiLENBQUE7O0FBQUEsOEJBNENBLEtBQUEsR0FBTyxTQUFDLFFBQUQsRUFBVyxTQUFYLEdBQUE7QUFDTixRQUFBLHFEQUFBO0FBQUEsSUFBQSxJQUFHLFFBQUEsS0FBWSxHQUFaLElBQW1CLFFBQUEsS0FBWSxHQUFsQztBQUNDLGFBQU8sU0FBUyxDQUFDLEtBQVYsQ0FBQSxDQUFQLENBREQ7S0FBQTtBQUFBLElBR0EsS0FBQSxHQUFRLFNBSFIsQ0FBQTtBQUFBLElBSUEsS0FBQSxHQUFRLFFBQVEsQ0FBQyxLQUFULENBQWUsR0FBZixDQUpSLENBQUE7QUFLQSxTQUFBLDRDQUFBOzJCQUFBO0FBQ0MsTUFBQSxJQUFHLFFBQUEsS0FBWSxHQUFmO0FBQ0MsUUFBQSxNQUFBLEdBQVMsSUFBVCxDQUFBO0FBQ0EsaUJBRkQ7T0FBQTtBQUlBLE1BQUEsSUFBRyxDQUFBLEtBQU0sQ0FBQyxXQUFWO0FBQ0MsZUFBTyxJQUFQLENBREQ7T0FKQTtBQUFBLE1BT0EsVUFBQSxHQUFhLEtBQUssQ0FBQyxVQUFVLENBQUMsT0FBakIsQ0FBQSxDQVBiLENBQUE7QUFBQSxNQVFBLEtBQUEsR0FBUSxJQVJSLENBQUE7QUFTQSxhQUFNLFNBQUEsR0FBWSxVQUFVLENBQUMsS0FBWCxDQUFBLENBQWxCLEdBQUE7QUFDQyxRQUFBLElBQUcsU0FBUyxDQUFDLEVBQVYsQ0FBYSxRQUFiLENBQUg7QUFDQyxVQUFBLEtBQUEsR0FBUSxTQUFSLENBQUE7QUFDQSxnQkFGRDtTQUFBLE1BR0ssSUFBRyxTQUFTLENBQUMsV0FBVixJQUF5QixDQUFBLE1BQTVCO0FBQ0osVUFBQSxVQUFVLENBQUMsTUFBWCxDQUFrQixTQUFTLENBQUMsVUFBVSxDQUFDLE9BQXJCLENBQUEsQ0FBbEIsQ0FBQSxDQURJO1NBSk47TUFBQSxDQVRBO0FBZ0JBLE1BQUEsSUFBRyxDQUFBLEtBQUg7QUFDQyxlQUFPLElBQVAsQ0FERDtPQWhCQTtBQUFBLE1BbUJBLE1BQUEsR0FBUyxLQW5CVCxDQUREO0FBQUEsS0FMQTtBQTJCTyxJQUFBLElBQUcsS0FBQSxLQUFXLFNBQWQ7YUFBNkIsTUFBN0I7S0FBQSxNQUFBO2FBQXdDLEtBQXhDO0tBNUJEO0VBQUEsQ0E1Q1AsQ0FBQTs7QUFBQSw4QkEyRUEsUUFBQSxHQUFVLFNBQUMsUUFBRCxFQUFXLFNBQVgsR0FBQTtBQUNULFFBQUEsbUlBQUE7QUFBQSxJQUFBLGFBQUEsR0FBZ0IsQ0FBQyxTQUFELENBQWhCLENBQUE7QUFBQSxJQUNBLFVBQUEsR0FBYSxTQUFTLENBQUMsVUFBVSxDQUFDLE9BQXJCLENBQUEsQ0FEYixDQUFBO0FBR0E7QUFBQSxTQUFBLDJDQUFBOzBCQUFBO0FBQ0MsTUFBQSxJQUFHLFFBQUEsS0FBWSxHQUFmO0FBQ0MsUUFBQSxNQUFBLEdBQVMsSUFBVCxDQUFBO0FBQ0EsaUJBRkQ7T0FBQTtBQUlBLE1BQUEsSUFBRyxVQUFVLENBQUMsTUFBWCxLQUFxQixDQUF4QjtBQUNDLGVBQU8sRUFBUCxDQUREO09BSkE7QUFBQSxNQU9BLFNBQUEsR0FBWSxRQUFRLENBQUMsS0FBVCxDQUFlLEdBQWYsQ0FQWixDQUFBO0FBQUEsTUFTQSxXQUFBLEdBQWMsRUFUZCxDQUFBO0FBVUEsV0FBQSxtREFBQTttQ0FBQTtBQUNDLFFBQUEsV0FBVyxDQUFDLElBQVosQ0FBaUIsU0FBakIsQ0FBQSxDQUREO0FBQUEsT0FWQTtBQUFBLE1BYUEsT0FBQSxHQUFVLEVBYlYsQ0FBQTtBQWNBLGFBQU0sU0FBQSxHQUFZLFVBQVUsQ0FBQyxLQUFYLENBQUEsQ0FBbEIsR0FBQTtBQUNDLGFBQUEsa0RBQUE7OEJBQUE7QUFDQyxVQUFBLElBQUcsU0FBUyxDQUFDLEVBQVYsQ0FBYSxHQUFiLENBQUEsSUFBcUIsYUFBYSxDQUFDLE9BQWQsQ0FBc0IsU0FBdEIsQ0FBQSxHQUFtQyxDQUEzRDtBQUNDLFlBQUEsT0FBTyxDQUFDLElBQVIsQ0FBYSxTQUFiLENBQUEsQ0FERDtXQUREO0FBQUEsU0FBQTtBQUdBLFFBQUEsSUFBRyxTQUFTLENBQUMsV0FBVixJQUF5QixDQUFDLENBQUEsTUFBQSxJQUFXLFdBQVcsQ0FBQyxPQUFaLENBQW9CLFNBQXBCLENBQUEsSUFBa0MsQ0FBOUMsQ0FBNUI7QUFDQyxVQUFBLFVBQVUsQ0FBQyxNQUFYLENBQWtCLFNBQVMsQ0FBQyxVQUFVLENBQUMsT0FBckIsQ0FBQSxDQUFsQixDQUFBLENBREQ7U0FKRDtNQUFBLENBZEE7QUFBQSxNQXFCQSxVQUFBLEdBQWEsT0FyQmIsQ0FBQTtBQUFBLE1BdUJBLGFBQUEsR0FBZ0IsRUF2QmhCLENBQUE7QUF3QkEsV0FBQSxtREFBQTttQ0FBQTtBQUNDLFFBQUEsYUFBYSxDQUFDLElBQWQsQ0FBbUIsU0FBbkIsQ0FBQSxDQUREO0FBQUEsT0F4QkE7QUFBQSxNQTJCQSxNQUFBLEdBQVMsS0EzQlQsQ0FERDtBQUFBLEtBSEE7QUFpQ0EsV0FBTyxVQUFQLENBbENTO0VBQUEsQ0EzRVYsQ0FBQTs7MkJBQUE7O0lBRkQsQ0FBQTs7QUFBQSxNQWtITSxDQUFDLE9BQVAsR0FBaUIsaUJBbEhqQixDQUFBOzs7O0FDQUEsSUFBQSx3Q0FBQTtFQUFBO2lTQUFBOztBQUFBLE1BQUEsR0FBUyxPQUFBLENBQVEsV0FBUixDQUFULENBQUE7O0FBQUEsU0FDQSxHQUFZLE9BQUEsQ0FBUSxhQUFSLENBRFosQ0FBQTs7QUFBQSxVQUVBLEdBQWEsT0FBQSxDQUFRLHFCQUFSLENBRmIsQ0FBQTs7QUFBQTtBQU9DLDhCQUFBLENBQUE7Ozs7R0FBQTs7QUFBQSxzQkFBQSxXQUFBLEdBQWEsSUFBYixDQUFBOztBQUFBLHNCQUVBLEtBQUEsR0FBTyxXQUZQLENBQUE7O0FBQUEsc0JBS0EsTUFBQSxHQUFRLE1BTFIsQ0FBQTs7QUFBQSxzQkFPQSxVQUFBLEdBQVksSUFQWixDQUFBOztBQUFBLHNCQVdBLE1BQUEsR0FBUSxTQUFBLEdBQUE7QUFDUCxJQUFBLG9DQUFBLENBQUEsQ0FBQTtBQUFBLElBQ0EsSUFBQyxDQUFBLFVBQUQsR0FBa0IsSUFBQSxVQUFBLENBQUEsQ0FEbEIsQ0FETztFQUFBLENBWFIsQ0FBQTs7QUFBQSxzQkF5QkEsWUFBQSxHQUFjLFNBQUMsSUFBRCxFQUFPLFNBQVAsR0FBQTtBQUNiLFFBQUEsVUFBQTtBQUFBLElBQUEsSUFBRyxDQUFBLElBQUssQ0FBQyxRQUFMLENBQWMsSUFBZCxDQUFKO0FBQ0MsTUFBQSxTQUFBLEdBQVksSUFBWixDQUFBO0FBQUEsTUFDQSxJQUFBLEdBQU8sU0FBUyxDQUFDLElBRGpCLENBREQ7S0FBQTtBQUlBLElBQUEsSUFBRyxDQUFBLElBQUEsSUFBWSxDQUFBLElBQVEsQ0FBQyxJQUFMLENBQVUsZ0JBQVYsQ0FBbkI7QUFDQyxZQUFVLElBQUEsS0FBQSxDQUFNLHlEQUFBLEdBQTRELElBQTVELEdBQW1FLFVBQXpFLENBQVYsQ0FERDtLQUpBO0FBT0EsSUFBQSxJQUFHLElBQUMsQ0FBQSxVQUFVLENBQUMsR0FBWixDQUFnQixJQUFoQixDQUFIO0FBQ0MsWUFBVSxJQUFBLEtBQUEsQ0FBTSx1QkFBQSxHQUEwQixJQUExQixHQUFpQyxtQkFBdkMsQ0FBVixDQUREO0tBUEE7QUFBQSxJQVdBLEdBQUEsR0FBTSxJQVhOLENBQUE7QUFZQSxXQUFBLElBQUEsR0FBQTtBQUNDLE1BQUEsSUFBRyxHQUFBLEtBQU8sU0FBVjtBQUNDLGNBQVUsSUFBQSxLQUFBLENBQU0sc0RBQUEsR0FBeUQsSUFBekQsR0FBZ0UsSUFBdEUsQ0FBVixDQUREO09BQUE7QUFBQSxNQUVBLEdBQUEsR0FBTSxHQUFHLENBQUMsU0FBSixDQUFBLENBRk4sQ0FBQTtBQUdBLE1BQUEsSUFBUyxHQUFBLEtBQU8sSUFBaEI7QUFBQSxjQUFBO09BSkQ7SUFBQSxDQVpBO0FBQUEsSUFtQkEsSUFBQyxDQUFBLHNCQUFELENBQXdCLFNBQXhCLENBbkJBLENBQUE7QUFBQSxJQW9CQSxJQUFDLENBQUEsSUFBRCxDQUFNLEtBQU4sRUFBYSxJQUFiLEVBQW1CLFNBQW5CLENBcEJBLENBQUE7QUFzQkE7QUFDQyxNQUFBLElBQUMsQ0FBQSxVQUFVLENBQUMsR0FBWixDQUFnQixJQUFoQixFQUFzQixTQUF0QixDQUFBLENBQUE7QUFBQSxNQUNBLFNBQVMsQ0FBQyxTQUFWLENBQW9CLElBQXBCLEVBQTBCLElBQTFCLENBREEsQ0FERDtLQUFBLGNBQUE7QUFJQyxNQURLLGNBQ0wsQ0FBQTtBQUFBLE1BQUEsSUFBQyxDQUFBLFVBQVUsQ0FBQyxNQUFaLENBQW1CLElBQW5CLENBQUEsQ0FBQTtBQUFBLE1BQ0EsT0FBTyxDQUFDLEdBQVIsQ0FBWSxLQUFaLEVBQW1CLEtBQUssQ0FBQyxLQUF6QixDQURBLENBQUE7QUFFQSxZQUFNLEtBQU4sQ0FORDtLQXRCQTtBQUFBLElBOEJBLElBQUMsQ0FBQSxjQUFELENBQWdCLFNBQWhCLENBOUJBLENBQUE7QUFBQSxJQStCQSxJQUFDLENBQUEsa0JBQUQsQ0FBb0IsU0FBcEIsQ0EvQkEsQ0FBQTtBQUFBLElBZ0NBLElBQUMsQ0FBQSxJQUFELENBQU0sT0FBTixFQUFlLElBQWYsRUFBcUIsU0FBckIsQ0FoQ0EsQ0FBQTtBQWlDQSxJQUFBLElBQStCLElBQUMsQ0FBQSxRQUFoQztBQUFBLE1BQUEsSUFBQyxDQUFBLGVBQUQsQ0FBaUIsU0FBakIsQ0FBQSxDQUFBO0tBakNBO0FBa0NBLFdBQU8sU0FBUCxDQW5DYTtFQUFBLENBekJkLENBQUE7O0FBQUEsc0JBK0RBLGNBQUEsR0FBZ0IsU0FBQyxTQUFELEdBQUEsQ0EvRGhCLENBQUE7O0FBQUEsc0JBb0VBLGtCQUFBLEdBQW9CLFNBQUMsU0FBRCxHQUFBO0FBQ25CLElBQUEsSUFBNkMsSUFBQyxDQUFBLFNBQTlDO0FBQUEsTUFBQSxJQUFDLENBQUEsU0FBUyxDQUFDLGtCQUFYLENBQThCLFNBQTlCLENBQUEsQ0FBQTtLQURtQjtFQUFBLENBcEVwQixDQUFBOztBQUFBLHNCQXlFQSxlQUFBLEdBQWlCLFNBQUMsSUFBRCxHQUFBO0FBQ2hCLFFBQUEsU0FBQTtBQUFBLElBQUEsSUFBRyxDQUFBLElBQUUsQ0FBQSxVQUFVLENBQUMsR0FBWixDQUFnQixJQUFoQixDQUFKO0FBQ0MsWUFBVSxJQUFBLEtBQUEsQ0FBTSxtQkFBQSxHQUFzQixJQUF0QixHQUE2QixxQ0FBbkMsQ0FBVixDQUREO0tBQUE7QUFBQSxJQUdBLFNBQUEsR0FBWSxJQUFDLENBQUEsVUFBVSxDQUFDLEdBQVosQ0FBZ0IsSUFBaEIsQ0FIWixDQUFBO0FBQUEsSUFJQSxJQUFDLENBQUEsSUFBRCxDQUFNLFFBQU4sRUFBZ0IsSUFBaEIsRUFBc0IsU0FBdEIsQ0FKQSxDQUFBO0FBQUEsSUFLQSxTQUFTLENBQUMsU0FBVixDQUFvQixJQUFwQixDQUxBLENBQUE7QUFBQSxJQU1BLElBQUMsQ0FBQSxVQUFVLENBQUMsTUFBWixDQUFtQixJQUFuQixDQU5BLENBQUE7QUFBQSxJQU9BLElBQUMsQ0FBQSxnQkFBRCxDQUFrQixTQUFsQixDQVBBLENBQUE7QUFBQSxJQVFBLElBQUMsQ0FBQSxvQkFBRCxDQUFzQixTQUF0QixDQVJBLENBQUE7QUFBQSxJQVNBLElBQUMsQ0FBQSxJQUFELENBQU0sU0FBTixFQUFpQixJQUFqQixFQUF1QixTQUF2QixDQVRBLENBRGdCO0VBQUEsQ0F6RWpCLENBQUE7O0FBQUEsc0JBdUZBLGdCQUFBLEdBQWtCLFNBQUEsR0FBQTtBQUNqQixJQUFBLElBQUMsQ0FBQSxVQUFVLENBQUMsSUFBWixDQUFpQixDQUFBLFNBQUEsS0FBQSxHQUFBO2FBQUEsU0FBQyxTQUFELEVBQVksSUFBWixHQUFBO0FBQ2hCLFFBQUEsS0FBQyxDQUFBLGVBQUQsQ0FBaUIsSUFBakIsQ0FBQSxDQUFBO0FBQUEsUUFDQSxTQUFTLENBQUMsT0FBVixDQUFBLENBREEsQ0FEZ0I7TUFBQSxFQUFBO0lBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFqQixDQUFBLENBRGlCO0VBQUEsQ0F2RmxCLENBQUE7O0FBQUEsc0JBK0ZBLGdCQUFBLEdBQWtCLFNBQUMsU0FBRCxHQUFBLENBL0ZsQixDQUFBOztBQUFBLHNCQW9HQSxvQkFBQSxHQUFzQixTQUFDLFNBQUQsR0FBQTtBQUNyQixRQUFBLE1BQUE7QUFBQSxJQUFBLE1BQUEsR0FBUyxJQUFDLENBQUEsU0FBRCxDQUFBLENBQVQsQ0FBQTtBQUNBLElBQUEsSUFBMkMsTUFBM0M7QUFBQSxNQUFBLE1BQU0sQ0FBQyxvQkFBUCxDQUE0QixTQUE1QixDQUFBLENBQUE7S0FGcUI7RUFBQSxDQXBHdEIsQ0FBQTs7QUFBQSxzQkE4R0EsWUFBQSxHQUFjLFNBQUMsSUFBRCxFQUFPLElBQVAsR0FBQTtBQUNiLFFBQUEsbUJBQUE7O01BRG9CLE9BQU87S0FDM0I7QUFBQSxJQUFBLElBQUcsQ0FBQSxJQUFIO0FBQ0MsWUFBVSxJQUFBLEtBQUEsQ0FBTSwwREFBTixDQUFWLENBREQ7S0FBQTtBQUFBLElBR0EsR0FBQSxHQUFNLElBSE4sQ0FBQTtBQUFBLElBSUEsR0FBQSxHQUFNLElBQUksQ0FBQyxPQUFMLENBQWEsR0FBYixDQUpOLENBQUE7QUFLQSxJQUFBLElBQUcsR0FBQSxHQUFNLENBQVQ7QUFDQyxNQUFBLEdBQUEsR0FBTSxJQUFJLENBQUMsU0FBTCxDQUFlLEdBQUEsR0FBTSxDQUFyQixDQUFOLENBQUE7QUFBQSxNQUNBLElBQUEsR0FBTyxJQUFJLENBQUMsU0FBTCxDQUFlLENBQWYsRUFBa0IsR0FBbEIsQ0FEUCxDQUREO0tBTEE7QUFTQSxJQUFBLElBQUcsSUFBQSxLQUFRLFFBQVg7QUFDUSxNQUFBLElBQUcsQ0FBQSxHQUFIO2VBQWEsSUFBQyxDQUFBLFVBQWQ7T0FBQSxNQUFBO2VBQTZCLElBQUMsQ0FBQSxTQUFTLENBQUMsWUFBWCxDQUF3QixHQUF4QixFQUE2QixJQUE3QixFQUE3QjtPQURSO0tBVEE7QUFZQSxJQUFBLElBQUcsQ0FBQSxJQUFFLENBQUEsVUFBVSxDQUFDLEdBQVosQ0FBZ0IsSUFBaEIsQ0FBSjtBQUNDLE1BQUEsU0FBQSxHQUFZLElBQUMsQ0FBQSxlQUFELENBQWlCLElBQWpCLENBQVosQ0FBQTtBQUNBLE1BQUEsSUFBRyxTQUFBLElBQWEsU0FBUyxDQUFDLFNBQVYsQ0FBQSxDQUFBLEtBQXlCLElBQXpDO0FBQ0MsUUFBQSxJQUFDLENBQUEsWUFBRCxDQUFjLElBQWQsRUFBb0IsU0FBcEIsQ0FBQSxDQUREO09BRkQ7S0FaQTtBQWlCQSxJQUFBLElBQUcsSUFBQyxDQUFBLFVBQVUsQ0FBQyxHQUFaLENBQWdCLElBQWhCLENBQUg7QUFDQyxNQUFBLElBQUcsQ0FBQSxHQUFIO0FBQ0MsZUFBTyxJQUFDLENBQUEsVUFBVSxDQUFDLEdBQVosQ0FBZ0IsSUFBaEIsQ0FBUCxDQUREO09BQUEsTUFBQTtBQUdDLGVBQU8sSUFBQyxDQUFBLFVBQVUsQ0FBQyxHQUFaLENBQWdCLElBQWhCLENBQXFCLENBQUMsWUFBdEIsQ0FBbUMsR0FBbkMsRUFBd0MsSUFBeEMsQ0FBUCxDQUhEO09BREQ7S0FBQSxNQUtLLElBQUcsSUFBSDtBQUNKLFlBQVUsSUFBQSxLQUFBLENBQU0sdUJBQUEsR0FBMEIsSUFBMUIsR0FBaUMsbUJBQXZDLENBQVYsQ0FESTtLQXZCUTtFQUFBLENBOUdkLENBQUE7O0FBQUEsc0JBMElBLGVBQUEsR0FBaUIsU0FBQyxJQUFELEdBQUE7QUFDaEIsUUFBQSxpQkFBQTtBQUFBLElBQUEsTUFBQSxHQUFTLGlCQUFBLEdBQWtCLElBQUksQ0FBQyxVQUFMLENBQUEsQ0FBM0IsQ0FBQTtBQUNBLElBQUEsSUFBRyxJQUFLLENBQUEsTUFBQSxDQUFSO0FBQ0MsTUFBQSxTQUFBLEdBQVksSUFBSyxDQUFBLE1BQUEsQ0FBTCxDQUFhLElBQWIsQ0FBWixDQUFBO0FBQ0EsTUFBQSxJQUFHLENBQUEsU0FBQSxJQUFjLENBQUEsSUFBRSxDQUFBLFVBQVUsQ0FBQyxHQUFaLENBQWdCLElBQWhCLENBQWxCO0FBQ0MsY0FBVSxJQUFBLEtBQUEsQ0FBTyxTQUFBLEdBQVEsSUFBUixHQUFjLElBQWQsR0FBaUIsTUFBakIsR0FBeUIsb0RBQWhDLENBQVYsQ0FERDtPQURBO0FBR0EsYUFBTyxTQUFQLENBSkQ7S0FEQTtBQU1BLFdBQU8sSUFBUCxDQVBnQjtFQUFBLENBMUlqQixDQUFBOztBQUFBLHNCQW9KQSxhQUFBLEdBQWUsU0FBQSxHQUFBO0FBQ2QsV0FBTyxJQUFDLENBQUEsVUFBVSxDQUFDLE1BQVosR0FBcUIsQ0FBNUIsQ0FEYztFQUFBLENBcEpmLENBQUE7O0FBQUEsc0JBd0pBLGFBQUEsR0FBZSxTQUFDLE9BQUQsR0FBQTtBQUNQLElBQUEsSUFBRyxPQUFIO2FBQWdCLElBQUMsQ0FBQSxVQUFVLENBQUMsT0FBWixDQUFBLEVBQWhCO0tBQUEsTUFBQTthQUEyQyxJQUFDLENBQUEsV0FBNUM7S0FETztFQUFBLENBeEpmLENBQUE7O0FBQUEsc0JBNEpBLGNBQUEsR0FBZ0IsU0FBQyxJQUFELEVBQWUsT0FBZixFQUE2QixVQUE3QixHQUFBOztNQUFDLE9BQU87S0FDdkI7O01BRDhCLFVBQVU7S0FDeEM7O01BRDRDLGFBQWE7S0FDekQ7QUFBQSxJQUFBLElBQUMsQ0FBQSxVQUFVLENBQUMsSUFBWixDQUFpQixTQUFDLFNBQUQsR0FBQTtBQUNoQixVQUFBLDhCQUFBO0FBQUEsTUFBQSxPQUFBLEdBQVUsS0FBVixDQUFBO0FBQ0EsV0FBQSxlQUFBOzhCQUFBO0FBQ0MsUUFBQSxRQUFBLEdBQVcsSUFBWCxDQUFBO0FBQ0EsUUFBQSxJQUFHLFNBQVUsQ0FBQSxJQUFBLENBQVYsS0FBbUIsS0FBdEI7QUFDQyxVQUFBLE9BQUEsR0FBVSxJQUFWLENBQUE7QUFDQSxnQkFGRDtTQUZEO0FBQUEsT0FEQTtBQU9BLE1BQUEsSUFBRyxDQUFBLFFBQUEsSUFBYSxPQUFoQjtBQUNDLFFBQUEsT0FBQSxHQUFVLElBQVYsQ0FBQTtBQUFBLFFBQ0EsVUFBVSxDQUFDLElBQVgsQ0FBZ0IsU0FBaEIsQ0FEQSxDQUREO09BUEE7QUFXQSxNQUFBLElBQUcsU0FBUyxDQUFDLFdBQVYsSUFBeUIsSUFBNUI7QUFDQyxRQUFBLFNBQVMsQ0FBQyxjQUFWLENBQXlCLElBQXpCLEVBQStCLE9BQS9CLEVBQXdDLFVBQXhDLENBQUEsQ0FERDtPQVpnQjtJQUFBLENBQWpCLENBQUEsQ0FBQTtBQWVBLFdBQU8sVUFBUCxDQWhCZTtFQUFBLENBNUpoQixDQUFBOztBQUFBLHNCQStLQSxhQUFBLEdBQWUsU0FBQyxJQUFELEVBQWUsT0FBZixHQUFBO0FBQ2QsUUFBQSxVQUFBOztNQURlLE9BQU87S0FDdEI7O01BRDZCLFVBQVU7S0FDdkM7QUFBQSxJQUFBLFVBQUEsR0FBYSxJQUFDLENBQUEsY0FBRCxDQUFnQixJQUFoQixFQUFzQixPQUF0QixDQUFiLENBQUE7QUFDTyxJQUFBLElBQUcsVUFBVSxDQUFDLE1BQVgsR0FBb0IsQ0FBdkI7YUFBOEIsVUFBVyxDQUFBLENBQUEsRUFBekM7S0FBQSxNQUFBO2FBQWlELEtBQWpEO0tBRk87RUFBQSxDQS9LZixDQUFBOztBQUFBLHNCQW9MQSxzQkFBQSxHQUF3QixTQUFDLEtBQUQsR0FBQSxDQXBMeEIsQ0FBQTs7QUFBQSxzQkE0TEEsVUFBQSxHQUFZLFNBQUEsR0FBQTtBQUNYLFdBQU8sSUFBQyxDQUFBLFVBQVUsQ0FBQyxRQUFaLENBQUEsQ0FBUCxDQURXO0VBQUEsQ0E1TFosQ0FBQTs7QUFBQSxzQkFnTUEsU0FBQSxHQUFXLFNBQUEsR0FBQTtBQUNWLFdBQU8sSUFBQyxDQUFBLFVBQVUsQ0FBQyxPQUFaLENBQUEsQ0FBUCxDQURVO0VBQUEsQ0FoTVgsQ0FBQTs7QUFBQSxzQkFvTUEsYUFBQSxHQUFlLFNBQUMsU0FBRCxHQUFBO0FBQ2QsUUFBQSxLQUFBO0FBQUEsSUFBQSxLQUFBLEdBQVEsSUFBQyxDQUFBLFVBQVUsQ0FBQyxPQUFaLENBQW9CLFNBQXBCLENBQVIsQ0FBQTtBQUNBLFdBQU8sQ0FBSSxLQUFBLEdBQVEsQ0FBUixHQUFZLElBQUMsQ0FBQSxVQUFVLENBQUMsTUFBM0IsR0FBdUMsSUFBQyxDQUFBLFVBQVUsQ0FBQyxLQUFaLENBQWtCLEtBQUEsR0FBUSxDQUExQixDQUF2QyxHQUF5RSxJQUExRSxDQUFQLENBRmM7RUFBQSxDQXBNZixDQUFBOztBQUFBLHNCQXlNQSxpQkFBQSxHQUFtQixTQUFDLFNBQUQsR0FBQTtBQUNsQixRQUFBLEtBQUE7QUFBQSxJQUFBLEtBQUEsR0FBUSxJQUFDLENBQUEsVUFBVSxDQUFDLE9BQVosQ0FBb0IsU0FBcEIsQ0FBUixDQUFBO0FBQ0EsV0FBTyxDQUFJLEtBQUEsR0FBUSxDQUFYLEdBQWtCLElBQUMsQ0FBQSxVQUFVLENBQUMsS0FBWixDQUFrQixLQUFBLEdBQVEsQ0FBMUIsQ0FBbEIsR0FBb0QsSUFBckQsQ0FBUCxDQUZrQjtFQUFBLENBek1uQixDQUFBOztBQUFBLHNCQThNQSxJQUFBLEdBQU0sU0FBQyxRQUFELEdBQUE7O01BQUMsV0FBVztLQUNqQjtBQUFBLFdBQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDLEtBQXZCLENBQTZCLFFBQTdCLEVBQXVDLElBQXZDLENBQVAsQ0FESztFQUFBLENBOU1OLENBQUE7O0FBQUEsc0JBa05BLE9BQUEsR0FBUyxTQUFDLFFBQUQsR0FBQTs7TUFBQyxXQUFXO0tBQ3BCO0FBQUEsV0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBdkIsQ0FBZ0MsUUFBaEMsRUFBMEMsSUFBMUMsQ0FBUCxDQURRO0VBQUEsQ0FsTlQsQ0FBQTs7QUFBQSxzQkFzTkEsS0FBQSxHQUFPLFNBQUMsUUFBRCxHQUFBO0FBQ04sUUFBQSxPQUFBOztNQURPLFdBQVc7S0FDbEI7QUFBQSxJQUFBLE9BQUEsR0FBVSxJQUFWLENBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxVQUFVLENBQUMsSUFBWixDQUFpQixDQUFBLFNBQUEsS0FBQSxHQUFBO2FBQUEsU0FBQyxTQUFELEdBQUE7QUFDaEIsUUFBQSxJQUFHLENBQUEsT0FBQSxJQUFZLFNBQVMsQ0FBQyxFQUFWLENBQWEsUUFBYixDQUFmO0FBQ0MsVUFBQSxPQUFBLEdBQVUsU0FBVixDQUREO1NBRGdCO01BQUEsRUFBQTtJQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBakIsQ0FEQSxDQUFBO0FBS0EsV0FBTyxPQUFQLENBTk07RUFBQSxDQXROUCxDQUFBOztBQUFBLHNCQStOQSxHQUFBLEdBQUssU0FBQyxJQUFELEVBQU8sSUFBUCxHQUFBOztNQUFPLE9BQU87S0FDbEI7QUFBQSxXQUFPLElBQUMsQ0FBQSxZQUFELENBQWMsSUFBZCxFQUFvQixJQUFwQixDQUFQLENBREk7RUFBQSxDQS9OTCxDQUFBOztBQUFBLHNCQW1PQSxHQUFBLEdBQUssU0FBQyxJQUFELEVBQU8sU0FBUCxHQUFBO0FBQ0osV0FBTyxJQUFDLENBQUEsWUFBRCxDQUFjLElBQWQsRUFBb0IsU0FBcEIsQ0FBUCxDQURJO0VBQUEsQ0FuT0wsQ0FBQTs7QUFBQSxzQkF1T0EsTUFBQSxHQUFRLFNBQUMsSUFBRCxHQUFBO0FBQ1AsV0FBTyxJQUFDLENBQUEsZUFBRCxDQUFpQixJQUFqQixDQUFQLENBRE87RUFBQSxDQXZPUixDQUFBOztBQUFBLHNCQStPQSxRQUFBLEdBQVUsU0FBQSxHQUFBO0FBQ1QsSUFBQSxzQ0FBQSxDQUFBLENBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxhQUFELENBQWUsSUFBZixDQURBLENBRFM7RUFBQSxDQS9PVixDQUFBOztBQUFBLHNCQXFQQSxhQUFBLEdBQWUsU0FBQyxNQUFELEdBQUE7QUFDZCxJQUFBLElBQUMsQ0FBQSxVQUFVLENBQUMsSUFBWixDQUFpQixTQUFDLFNBQUQsR0FBQTtBQUNoQixNQUFBLElBQUcsU0FBUyxDQUFDLFNBQWI7QUFDQyxRQUFBLFNBQVMsQ0FBQyxRQUFWLENBQUEsQ0FBQSxDQUREO09BQUEsTUFFSyxJQUFHLFNBQVMsQ0FBQyxXQUFiO0FBQ0osUUFBQSxTQUFTLENBQUMsYUFBVixDQUF3QixNQUF4QixDQUFBLENBREk7T0FIVztJQUFBLENBQWpCLENBQUEsQ0FEYztFQUFBLENBclBmLENBQUE7O0FBQUEsc0JBbVFBLE1BQUEsR0FBUSxTQUFBLEdBQUE7QUFDUCxJQUFBLElBQUcsSUFBQyxDQUFBLE1BQUQsSUFBVyxJQUFDLENBQUEsTUFBRCxZQUFtQixNQUFNLENBQUMsTUFBeEM7QUFDQyxNQUFBLElBQUMsQ0FBQSxNQUFNLENBQUMsTUFBUixDQUFBLENBQUEsQ0FERDtLQURPO0VBQUEsQ0FuUVIsQ0FBQTs7QUFBQSxzQkF5UUEsU0FBQSxHQUFXLFNBQUEsR0FBQTtBQUNWLFdBQU8sSUFBQyxDQUFBLE1BQUQsS0FBYSxJQUFiLElBQXFCLElBQUMsQ0FBQSxNQUFELEtBQWEsS0FBekMsQ0FEVTtFQUFBLENBelFYLENBQUE7O0FBQUEsc0JBNlFBLFNBQUEsR0FBVyxTQUFDLE1BQUQsR0FBQTs7TUFBQyxTQUFTO0tBQ3BCO0FBQUEsSUFBQSxJQUFHLElBQUMsQ0FBQSxNQUFELElBQVcsSUFBQyxDQUFBLE1BQUQsWUFBbUIsTUFBTSxDQUFDLE1BQXJDLElBQStDLENBQUEsTUFBbEQ7QUFDQyxNQUFBLElBQUMsQ0FBQSxNQUFNLENBQUMsWUFBUixDQUFxQixJQUFyQixDQUFBLENBQUE7QUFBQSxNQUNBLElBQUMsQ0FBQSxNQUFELEdBQVUsSUFEVixDQUREO0tBQUE7QUFHQSxJQUFBLElBQUcsTUFBSDtBQUNDLE1BQUEsSUFBQyxDQUFBLE1BQUQsR0FBVSxNQUFWLENBQUE7QUFBQSxNQUNBLElBQUMsQ0FBQSxNQUFNLENBQUMsWUFBUixDQUFxQixJQUFyQixDQURBLENBQUE7QUFBQSxNQUVBLElBQUMsQ0FBQSxNQUFNLENBQUMsVUFBUixDQUFBLENBRkEsQ0FERDtLQUpVO0VBQUEsQ0E3UVgsQ0FBQTs7QUFBQSxzQkF3UkEsU0FBQSxHQUFXLFNBQUEsR0FBQTtBQUNWLElBQUEsSUFBRyxJQUFJLENBQUMsUUFBTCxDQUFjLElBQUMsQ0FBQSxNQUFmLENBQUg7QUFDQyxNQUFBLElBQUMsQ0FBQSxTQUFELENBQVcsTUFBTSxDQUFDLFlBQVAsQ0FBb0IsSUFBQyxDQUFBLE1BQXJCLENBQVgsQ0FBQSxDQUREO0tBQUE7QUFFQSxXQUFPLElBQUMsQ0FBQSxNQUFSLENBSFU7RUFBQSxDQXhSWCxDQUFBOztBQUFBLHNCQThSQSxhQUFBLEdBQWUsU0FBQyxPQUFELEdBQUE7QUFDZCxJQUFBLDhDQUFBLFNBQUEsQ0FBQSxDQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsVUFBVSxDQUFDLElBQVosQ0FBaUIsU0FBQyxTQUFELEdBQUE7YUFBYyxTQUFTLENBQUMsYUFBVixDQUF3QixPQUF4QixFQUFkO0lBQUEsQ0FBakIsQ0FEQSxDQURjO0VBQUEsQ0E5UmYsQ0FBQTs7QUFBQSxzQkFvU0EsUUFBQSxHQUFVLFNBQUEsR0FBQTtBQUNULElBQUEseUNBQUEsU0FBQSxDQUFBLENBQUE7QUFBQSxJQUVBLElBQUMsQ0FBQSxlQUFELENBQUEsQ0FGQSxDQUFBO0FBQUEsSUFLQSxJQUFDLENBQUEsVUFBVSxDQUFDLElBQVosQ0FBaUIsQ0FBQSxTQUFBLEtBQUEsR0FBQTthQUFBLFNBQUMsU0FBRCxHQUFBO0FBQ2hCLFFBQUEsSUFBZ0MsQ0FBQSxTQUFVLENBQUMsUUFBM0M7aUJBQUEsS0FBQyxDQUFBLGVBQUQsQ0FBaUIsU0FBakIsRUFBQTtTQURnQjtNQUFBLEVBQUE7SUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQWpCLENBTEEsQ0FBQTtBQVNBLElBQUEsSUFBRyxJQUFDLENBQUEsTUFBSjtBQUNDLE1BQUEsSUFBQyxDQUFBLFNBQUQsQ0FBQSxDQUFZLENBQUMsTUFBYixDQUFBLENBQUEsQ0FERDtLQVZTO0VBQUEsQ0FwU1YsQ0FBQTs7QUFBQSxzQkFtVEEsZUFBQSxHQUFpQixTQUFBLEdBQUE7QUFFaEIsUUFBQSxnR0FBQTtBQUFBLElBQUEsZUFBQSxHQUFrQixFQUFsQixDQUFBO0FBQ0E7QUFBQSxTQUFBLDJDQUFBO29CQUFBO0FBQ0MsTUFBQSxXQUFBLEdBQWMsS0FBZCxDQUFBO0FBQ0EsTUFBQSxJQUFHLGVBQWUsQ0FBQyxRQUFoQixDQUF5QixFQUF6QixDQUFIO0FBQ0MsUUFBQSxXQUFBLEdBQWMsSUFBZCxDQUREO09BQUEsTUFBQTtBQUdDO0FBQUEsYUFBQSw4Q0FBQTs2QkFBQTtBQUNDLFVBQUEsSUFBRyxlQUFlLENBQUMsUUFBaEIsQ0FBeUIsTUFBekIsQ0FBSDtBQUNDLFlBQUEsV0FBQSxHQUFjLElBQWQsQ0FBQTtBQUNBLHFCQUZEO1dBREQ7QUFBQSxTQUhEO09BREE7QUFRQSxNQUFBLElBQUcsQ0FBQSxXQUFIO0FBQ0MsUUFBQSxlQUFlLENBQUMsSUFBaEIsQ0FBcUIsRUFBckIsQ0FBQSxDQUREO09BVEQ7QUFBQSxLQURBO0FBY0EsU0FBQSx3REFBQTsrQkFBQTtBQUNDLE1BQUEsU0FBQSxHQUFZLElBQUMsQ0FBQSxHQUFELENBQUssRUFBRSxDQUFDLFlBQUgsQ0FBZ0IsZ0JBQWhCLENBQUwsRUFBd0MsSUFBeEMsQ0FBWixDQUFBO0FBQUEsTUFDQSxTQUFTLENBQUMsT0FBVixDQUFrQixFQUFsQixDQURBLENBREQ7QUFBQSxLQWhCZ0I7RUFBQSxDQW5UakIsQ0FBQTs7QUFBQSxzQkF5VUEsZUFBQSxHQUFpQixTQUFDLFNBQUQsR0FBQTtBQUNoQixJQUFBLElBQUcsQ0FBQSxTQUFVLENBQUMsaUJBQWQ7QUFDQyxNQUFBLFNBQVMsQ0FBQyxNQUFWLENBQWlCLElBQUMsQ0FBQSxZQUFELENBQUEsQ0FBakIsQ0FBQSxDQUREO0tBRGdCO0VBQUEsQ0F6VWpCLENBQUE7O0FBQUEsc0JBK1VBLFdBQUEsR0FBYSxTQUFDLE1BQUQsR0FBQTtBQUNaLElBQUEsMkNBQU0sTUFBTixDQUFBLENBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxVQUFVLENBQUMsSUFBWixDQUFpQixTQUFDLFNBQUQsR0FBQTtBQUNoQixNQUFBLFNBQVMsQ0FBQyxXQUFWLENBQXNCLE1BQXRCLENBQUEsQ0FEZ0I7SUFBQSxDQUFqQixDQURBLENBRFk7RUFBQSxDQS9VYixDQUFBOztBQUFBLHNCQXVWQSxTQUFBLEdBQVcsU0FBQSxHQUFBO0FBQ1YsSUFBQSxJQUFDLENBQUEsZ0JBQUQsQ0FBQSxDQUFBLENBQUE7QUFDQSxJQUFBLElBQW9CLElBQUMsQ0FBQSxTQUFELENBQUEsQ0FBcEI7QUFBQSxNQUFBLElBQUMsQ0FBQSxTQUFELENBQVcsSUFBWCxDQUFBLENBQUE7S0FEQTtXQUVBLHVDQUFBLEVBSFU7RUFBQSxDQXZWWCxDQUFBOzttQkFBQTs7R0FGdUIsVUFMeEIsQ0FBQTs7QUFBQSxNQXNXTSxDQUFDLE9BQVAsR0FBaUIsU0F0V2pCLENBQUE7Ozs7QUNBQSxJQUFBLCtCQUFBO0VBQUE7aVNBQUE7O0FBQUEsVUFBQSxHQUFhLE9BQUEsQ0FBUSxnQkFBUixDQUFiLENBQUE7O0FBQUE7QUFLQyxpQ0FBQSxDQUFBOzs7O0dBQUE7O0FBQUEseUJBQUEsY0FBQSxHQUFnQixZQUFDLENBQUEsTUFBRCxDQUFRLGdCQUFSLEVBQTBCLHlCQUExQixDQUFoQixDQUFBOztBQUFBLHlCQUdBLFNBQUEsR0FBVyxTQUFDLFNBQUQsR0FBQTtBQUNWLFFBQUEsTUFBQTtBQUFBLElBQUEsTUFBQSxHQUFTLElBQUMsQ0FBQSxjQUFjLENBQUMsSUFBaEIsQ0FBcUIsU0FBckIsQ0FBVCxDQUFBO0FBQ0EsV0FBVyxJQUFBLEtBQUEsQ0FBTSxJQUFOLEVBQVksU0FBWixFQUF1QixNQUFBLElBQVEsRUFBL0IsQ0FBWCxDQUZVO0VBQUEsQ0FIWCxDQUFBOztBQUFBLHlCQVFBLFNBQUEsR0FBVyxTQUFDLEtBQUQsR0FBQTtBQUNWLElBQUEsSUFBQyxDQUFBLGNBQWMsQ0FBQyxJQUFoQixDQUFxQixLQUFLLENBQUMsSUFBM0IsRUFBaUMsS0FBSyxDQUFDLE1BQXZDLENBQUEsQ0FEVTtFQUFBLENBUlgsQ0FBQTs7c0JBQUE7O0dBRjBCLFdBSDNCLENBQUE7O0FBQUE7QUFzQmMsRUFBQSxlQUFFLEdBQUYsRUFBUSxJQUFSLEVBQWUsSUFBZixHQUFBO0FBQ1osSUFEYSxJQUFDLENBQUEsTUFBQSxHQUNkLENBQUE7QUFBQSxJQURtQixJQUFDLENBQUEsT0FBQSxJQUNwQixDQUFBO0FBQUEsSUFEMEIsSUFBQyxDQUFBLE9BQUEsSUFDM0IsQ0FBQTtBQUFBLFVBQUEsQ0FEWTtFQUFBLENBQWI7O0FBQUEsa0JBSUEsR0FBQSxHQUFLLFNBQUMsSUFBRCxFQUFPLEdBQVAsR0FBQTtBQUNHLElBQUEsSUFBRyxJQUFDLENBQUEsSUFBSSxDQUFDLGNBQU4sQ0FBcUIsSUFBckIsQ0FBSDthQUFtQyxJQUFDLENBQUEsSUFBSyxDQUFBLElBQUEsRUFBekM7S0FBQSxNQUFBO2FBQW9ELElBQXBEO0tBREg7RUFBQSxDQUpMLENBQUE7O0FBQUEsa0JBUUEsR0FBQSxHQUFLLFNBQUMsSUFBRCxFQUFPLEtBQVAsR0FBQTtBQUNKLElBQUEsSUFBRyxLQUFBLEtBQVcsTUFBZDtBQUNDLE1BQUEsSUFBQyxDQUFBLElBQUssQ0FBQSxJQUFBLENBQU4sR0FBYyxLQUFkLENBREQ7S0FBQSxNQUFBO0FBR0MsTUFBQSxNQUFBLENBQUEsSUFBUSxDQUFBLElBQUssQ0FBQSxJQUFBLENBQWIsQ0FIRDtLQUFBO0FBSUEsV0FBTyxJQUFQLENBTEk7RUFBQSxDQVJMLENBQUE7O0FBQUEsa0JBZ0JBLElBQUEsR0FBTSxTQUFBLEdBQUE7QUFDTCxJQUFBLElBQUMsQ0FBQSxHQUFHLENBQUMsU0FBTCxDQUFlLElBQWYsQ0FBQSxDQUFBO0FBQ0EsV0FBTyxJQUFQLENBRks7RUFBQSxDQWhCTixDQUFBOztlQUFBOztJQXRCRCxDQUFBOztBQUFBLE1BNENNLENBQUMsT0FBUCxHQUFpQixZQTVDakIsQ0FBQTs7OztBQ0FBLElBQUEsMEJBQUE7RUFBQTtpU0FBQTs7QUFBQSxVQUFBLEdBQWEsT0FBQSxDQUFRLGdCQUFSLENBQWIsQ0FBQTs7QUFBQTtBQUtDLG1DQUFBLENBQUE7O0FBQUEsMkJBQUEsS0FBQSxHQUFPLElBQVAsQ0FBQTs7QUFHYSxFQUFBLHdCQUFBLEdBQUE7QUFDWixJQUFBLGlEQUFBLFNBQUEsQ0FBQSxDQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsS0FBRCxHQUFTLEVBRFQsQ0FBQTtBQUVBLFVBQUEsQ0FIWTtFQUFBLENBSGI7O0FBQUEsMkJBU0EsSUFBQSxHQUFNLFNBQUMsSUFBRCxHQUFBO0FBQ0wsV0FBTyxJQUFDLENBQUEsS0FBTSxDQUFBLElBQUEsQ0FBZCxDQURLO0VBQUEsQ0FUTixDQUFBOztBQUFBLDJCQWFBLElBQUEsR0FBTSxTQUFDLElBQUQsRUFBTyxJQUFQLEdBQUE7QUFDTCxJQUFBLElBQUMsQ0FBQSxLQUFNLENBQUEsSUFBQSxDQUFQLEdBQWUsSUFBZixDQURLO0VBQUEsQ0FiTixDQUFBOzt3QkFBQTs7R0FGNEIsV0FIN0IsQ0FBQTs7QUFBQSxNQXVCTSxDQUFDLE9BQVAsR0FBaUIsY0F2QmpCLENBQUE7Ozs7QUNBQSxJQUFBLGtDQUFBO0VBQUE7aVNBQUE7O0FBQUEsVUFBQSxHQUFhLE9BQUEsQ0FBUSxnQkFBUixDQUFiLENBQUE7O0FBQUEsT0FDQSxHQUFVLE9BQUEsQ0FBUSxrQkFBUixDQURWLENBQUE7O0FBQUE7QUFNQyxrQ0FBQSxDQUFBOztBQUFBLDBCQUFBLFVBQUEsR0FBWSxLQUFaLENBQUE7O0FBQUEsMEJBQ0EsTUFBQSxHQUFRLENBRFIsQ0FBQTs7QUFBQSwwQkFFQSxJQUFBLEdBQU0sSUFGTixDQUFBOztBQUFBLDBCQUdBLEtBQUEsR0FBTyxJQUhQLENBQUE7O0FBQUEsMEJBSUEsS0FBQSxHQUFPLElBSlAsQ0FBQTs7QUFBQSwwQkFLQSxPQUFBLEdBQVMsSUFMVCxDQUFBOztBQVFhLEVBQUEsdUJBQUEsR0FBQTtBQUNaLElBQUEsZ0RBQUEsU0FBQSxDQUFBLENBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxJQUFELEdBQVEsRUFEUixDQUFBO0FBQUEsSUFFQSxJQUFDLENBQUEsS0FBRCxHQUFTLEVBRlQsQ0FBQTtBQUFBLElBR0EsSUFBQyxDQUFBLE1BQUQsR0FBVSxJQUFDLENBQUEsVUFIWCxDQUFBO0FBSUEsVUFBQSxDQUxZO0VBQUEsQ0FSYjs7QUFBQSwwQkFvQkEsUUFBQSxHQUFVLFNBQUMsSUFBRCxHQUFBO0FBQ1QsSUFBQSxJQUFvQyxJQUFJLENBQUMsU0FBekM7QUFBQSxNQUFBLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBZixDQUEwQixJQUExQixDQUFBLENBQUE7S0FBQTtBQUFBLElBQ0EsSUFBSSxDQUFDLFNBQUwsR0FBaUIsSUFEakIsQ0FBQTtBQUFBLElBRUEsSUFBQyxDQUFBLElBQUssQ0FBQSxJQUFJLENBQUMsRUFBTCxDQUFOLEdBQWlCLElBRmpCLENBQUE7QUFBQSxJQUdBLElBQUMsQ0FBQSxLQUFLLENBQUMsSUFBUCxDQUFZLElBQVosQ0FIQSxDQUFBO0FBQUEsSUFJQSxJQUFJLENBQUMsRUFBTCxDQUFRLE1BQVIsRUFBZ0IsSUFBQyxDQUFBLEtBQUQsQ0FBTyxpQkFBUCxDQUFoQixDQUpBLENBRFM7RUFBQSxDQXBCVixDQUFBOztBQUFBLDBCQWdDQSxVQUFBLEdBQVksU0FBQyxJQUFELEdBQUE7QUFDWCxJQUFBLElBQUcsSUFBQyxDQUFBLElBQUssQ0FBQSxJQUFJLENBQUMsRUFBTCxDQUFUO0FBQ0MsTUFBQSxJQUFJLENBQUMsRUFBTCxDQUFRLE1BQVIsRUFBZ0IsSUFBQyxDQUFBLEtBQUQsQ0FBTyxpQkFBUCxDQUFoQixDQUFBLENBQUE7QUFBQSxNQUNBLE1BQUEsQ0FBQSxJQUFRLENBQUEsSUFBSyxDQUFBLElBQUksQ0FBQyxFQUFMLENBRGIsQ0FBQTtBQUFBLE1BRUEsSUFBQyxDQUFBLEtBQUssQ0FBQyxLQUFQLENBQWEsSUFBYixDQUZBLENBQUE7QUFBQSxNQUdBLE1BQUEsQ0FBQSxJQUFXLENBQUMsU0FIWixDQUFBO0FBSUEsTUFBQSxJQUFtQixJQUFDLENBQUEsS0FBRCxLQUFVLElBQTdCO0FBQUEsUUFBQSxJQUFDLENBQUEsWUFBRCxDQUFBLENBQUEsQ0FBQTtPQUxEO0tBRFc7RUFBQSxDQWhDWixDQUFBOztBQUFBLDBCQTRDQSxHQUFBLEdBQUssU0FBQyxFQUFELEdBQUE7QUFDSixXQUFPLENBQUksRUFBRSxDQUFDLFdBQU4sR0FBdUIsRUFBdkIsR0FBK0IsSUFBQyxDQUFBLElBQUssQ0FBQSxFQUFBLENBQXRDLENBQVAsQ0FESTtFQUFBLENBNUNMLENBQUE7O0FBQUEsMEJBa0RBLFNBQUEsR0FBVyxTQUFBLEdBQUE7QUFDVixXQUFPLElBQUMsQ0FBQSxLQUFSLENBRFU7RUFBQSxDQWxEWCxDQUFBOztBQUFBLDBCQXNEQSxlQUFBLEdBQWlCLFNBQUEsR0FBQTtBQUNoQixJQUFBLElBQUMsQ0FBQSxZQUFELENBQUEsQ0FBQSxDQURnQjtFQUFBLENBdERqQixDQUFBOztBQUFBLDBCQTJEQSxTQUFBLEdBQVcsU0FBQSxHQUFBO0FBQ1YsSUFBQSxJQUFDLENBQUEsTUFBRCxHQUFVLElBQUMsQ0FBQSxZQUFELENBQWMsSUFBQyxDQUFBLFVBQWYsQ0FBVixDQURVO0VBQUEsQ0EzRFgsQ0FBQTs7QUFBQSwwQkFnRUEsWUFBQSxHQUFjLFNBQUMsTUFBRCxHQUFBO0FBQ2IsUUFBQSxvQkFBQTtBQUFBO0FBQUEsU0FBQSwyQ0FBQTtzQkFBQTtBQUNDLE1BQUEsTUFBQSxHQUFTLElBQUksQ0FBQyxTQUFMLENBQWUsTUFBZixDQUFULENBREQ7QUFBQSxLQUFBO0FBQUEsSUFFQSxJQUFDLENBQUEsWUFBRCxDQUFBLENBRkEsQ0FBQTtBQUdBLFdBQU8sTUFBUCxDQUphO0VBQUEsQ0FoRWQsQ0FBQTs7QUFBQSwwQkF1RUEsY0FBQSxHQUFnQixTQUFDLElBQUQsRUFBTyxRQUFQLEdBQUE7QUFDZixJQUFBLElBQUcsSUFBQSxLQUFVLElBQUMsQ0FBQSxLQUFkO0FBQ0MsTUFBQSxJQUFHLElBQUMsQ0FBQSxLQUFELElBQVcsQ0FBQSxJQUFFLENBQUEsS0FBSyxDQUFDLFVBQXRCO0FBQ0MsUUFBQSxJQUFDLENBQUEsS0FBSyxDQUFDLFNBQVAsQ0FBaUIsS0FBakIsRUFBd0IsSUFBeEIsQ0FBQSxDQUREO09BQUE7QUFBQSxNQUVBLElBQUMsQ0FBQSxLQUFELEdBQVMsSUFGVCxDQUFBO0FBR0EsTUFBQSxJQUFHLElBQUEsSUFBUyxJQUFBLEtBQVUsUUFBdEI7QUFHQyxRQUFBLElBQUcsSUFBSSxDQUFDLGNBQVI7QUFDQyxVQUFBLElBQUksQ0FBQyxRQUFMLENBQUEsQ0FBQSxDQUREO1NBQUE7QUFBQSxRQUVBLElBQUksQ0FBQyxTQUFMLENBQWUsSUFBZixDQUZBLENBQUE7QUFHQSxRQUFBLElBQUcsSUFBSSxDQUFDLEtBQVI7QUFDQyxVQUFBLElBQUMsQ0FBQSxXQUFELENBQWEsSUFBYixDQUFBLENBREQ7U0FORDtPQUpEO0tBRGU7RUFBQSxDQXZFaEIsQ0FBQTs7QUFBQSwwQkEwRkEsWUFBQSxHQUFjLFNBQUEsR0FBQTtBQUNiLFFBQUEsV0FBQTtBQUFBLElBQUEsS0FBQSxHQUFRLElBQUMsQ0FBQSxLQUFLLENBQUMsTUFBUCxHQUFnQixDQUF4QixDQUFBO0FBS0EsV0FBTSxLQUFBLElBQVMsQ0FBVCxJQUFlLENBQUEsSUFBRSxDQUFBLEtBQU0sQ0FBQSxLQUFBLENBQU0sQ0FBQyxTQUFkLENBQUEsQ0FBdEIsR0FBQTtBQUNDLE1BQUEsS0FBQSxFQUFBLENBREQ7SUFBQSxDQUxBO0FBU0EsSUFBQSxJQUFHLEtBQUEsSUFBUyxDQUFaO0FBQ0MsTUFBQSxJQUFBLEdBQU8sSUFBQyxDQUFBLEtBQU0sQ0FBQSxLQUFBLENBQWQsQ0FBQTtBQUFBLE1BQ0EsSUFBQyxDQUFBLGNBQUQsQ0FBZ0IsSUFBaEIsRUFBc0IsSUFBQyxDQUFBLEtBQXZCLENBREEsQ0FBQTtBQUVBLE1BQUEsSUFBRyxJQUFJLENBQUMsS0FBUjtBQUFtQixjQUFBLENBQW5CO09BSEQ7S0FBQSxNQUFBO0FBTUMsTUFBQSxJQUE0QixJQUFDLENBQUEsS0FBN0I7QUFBQSxRQUFBLElBQUMsQ0FBQSxLQUFLLENBQUMsU0FBUCxDQUFpQixLQUFqQixDQUFBLENBQUE7T0FBQTtBQUFBLE1BQ0EsSUFBQyxDQUFBLEtBQUQsR0FBUyxJQURULENBTkQ7S0FUQTtBQW9CQSxXQUFNLEtBQUEsSUFBUyxDQUFmLEdBQUE7QUFDQyxNQUFBLElBQUEsR0FBTyxJQUFDLENBQUEsS0FBTSxDQUFBLEtBQUEsQ0FBZCxDQUFBO0FBRUEsTUFBQSxJQUFHLElBQUksQ0FBQyxTQUFMLENBQUEsQ0FBQSxJQUFxQixJQUFJLENBQUMsS0FBN0I7QUFDQyxRQUFBLElBQUMsQ0FBQSxXQUFELENBQWEsSUFBYixDQUFBLENBQUE7QUFDQSxjQUFBLENBRkQ7T0FGQTtBQUFBLE1BS0EsS0FBQSxFQUxBLENBREQ7SUFBQSxDQXBCQTtBQUFBLElBOEJBLElBQUMsQ0FBQSxXQUFELENBQUEsQ0E5QkEsQ0FEYTtFQUFBLENBMUZkLENBQUE7O0FBQUEsMEJBNkhBLFdBQUEsR0FBYSxTQUFDLElBQUQsR0FBQTtBQUNaLElBQUEsSUFBRyxDQUFBLElBQUUsQ0FBQSxPQUFMO0FBQ0MsTUFBQSxJQUFDLENBQUEsT0FBRCxHQUFlLElBQUEsT0FBQSxDQUFRLElBQUksQ0FBQyxJQUFiLENBQWYsQ0FBQTtBQUFBLE1BQ0EsSUFBQyxDQUFBLE9BQU8sQ0FBQyxFQUFULENBQVksT0FBWixFQUFxQixDQUFBLFNBQUEsS0FBQSxHQUFBO2VBQUEsU0FBQSxHQUFBO0FBQ3BCLFVBQUEsSUFBRyxLQUFDLENBQUEsS0FBSjtBQUNDLFlBQUEsS0FBQyxDQUFBLEtBQUssQ0FBQyxRQUFQLENBQWdCLElBQWhCLENBQUEsQ0FBQTtBQUNBLFlBQUEsSUFBNEIsS0FBQyxDQUFBLEtBQUssQ0FBQyxjQUFuQztBQUFBLGNBQUEsS0FBQyxDQUFBLEtBQUssQ0FBQyxjQUFQLENBQUEsQ0FBQSxDQUFBO2FBRkQ7V0FEb0I7UUFBQSxFQUFBO01BQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFyQixDQURBLENBREQ7S0FBQTtBQUFBLElBUUEsSUFBQyxDQUFBLE9BQU8sQ0FBQyxTQUFULENBQW1CLElBQUksQ0FBQyxTQUFMLENBQUEsQ0FBQSxHQUFtQixDQUF0QyxDQVJBLENBQUE7QUFBQSxJQVNBLElBQUMsQ0FBQSxPQUFPLENBQUMsSUFBVCxDQUFBLENBVEEsQ0FEWTtFQUFBLENBN0hiLENBQUE7O0FBQUEsMEJBMklBLFdBQUEsR0FBYSxTQUFBLEdBQUE7QUFDWixJQUFBLElBQUcsSUFBQyxDQUFBLE9BQUo7QUFDQyxNQUFBLElBQUMsQ0FBQSxPQUFPLENBQUMsS0FBVCxDQUFBLENBQUEsQ0FERDtLQURZO0VBQUEsQ0EzSWIsQ0FBQTs7QUFBQSwwQkFvSkEsWUFBQSxHQUFjLFNBQUMsSUFBRCxHQUFBO0FBQ2IsUUFBQSxPQUFBO0FBQUEsSUFBQSxPQUFBLEdBQVUsS0FBVixDQUFBO0FBQUEsSUFDQSxJQUFBLEdBQU8sSUFBQyxDQUFBLEdBQUQsQ0FBSyxJQUFMLENBRFAsQ0FBQTtBQUVBLElBQUEsSUFBRyxJQUFBLEtBQVUsSUFBQyxDQUFBLEtBQWQ7QUFDQyxNQUFBLElBQUMsQ0FBQSxLQUFLLENBQUMsS0FBUCxDQUFhLElBQWIsQ0FBQSxDQUFBO0FBQUEsTUFDQSxJQUFDLENBQUEsS0FBSyxDQUFDLElBQVAsQ0FBWSxJQUFaLENBREEsQ0FBQTtBQUFBLE1BRUEsSUFBQyxDQUFBLFNBQUQsQ0FBQSxDQUZBLENBQUE7QUFBQSxNQUdBLElBQUMsQ0FBQSxLQUFELEdBQVMsSUFIVCxDQUFBO0FBQUEsTUFJQSxPQUFBLEdBQVUsSUFKVixDQUREO0tBRkE7QUFRQSxJQUFBLElBQUcsT0FBQSxJQUFZLElBQUksQ0FBQyxLQUFwQjtBQUNDLE1BQUEsSUFBQyxDQUFBLFdBQUQsQ0FBYSxJQUFiLENBQUEsQ0FERDtLQVJBO0FBVUEsV0FBTyxPQUFQLENBWGE7RUFBQSxDQXBKZCxDQUFBOztBQUFBLDBCQXFLQSxVQUFBLEdBQVksU0FBQyxJQUFELEdBQUE7QUFDWCxJQUFBLElBQUEsR0FBTyxJQUFDLENBQUEsR0FBRCxDQUFLLElBQUwsQ0FBUCxDQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsS0FBSyxDQUFDLEtBQVAsQ0FBYSxJQUFiLENBREEsQ0FBQTtBQUFBLElBRUEsSUFBQyxDQUFBLEtBQUssQ0FBQyxPQUFQLENBQWUsSUFBZixDQUZBLENBQUE7QUFBQSxJQUdBLElBQUMsQ0FBQSxTQUFELENBQUEsQ0FIQSxDQUFBO0FBSUEsV0FBTyxJQUFQLENBTFc7RUFBQSxDQXJLWixDQUFBOztBQUFBLDBCQTZLQSxTQUFBLEdBQVcsU0FBQSxHQUFBO0FBQ1YsUUFBQSxFQUFBO0FBQUEsSUFBQSxJQUFHLElBQUMsQ0FBQSxPQUFKO0FBQ0MsTUFBQSxJQUFDLENBQUEsT0FBTyxDQUFDLE9BQVQsQ0FBQSxDQUFBLENBQUE7QUFBQSxNQUNBLE1BQUEsQ0FBQSxJQUFRLENBQUEsT0FEUixDQUREO0tBQUE7QUFJQSxTQUFBLGVBQUEsR0FBQTtBQUNDLE1BQUEsSUFBQyxDQUFBLFVBQUQsQ0FBWSxJQUFDLENBQUEsR0FBRCxDQUFLLEVBQUwsQ0FBWixDQUFBLENBREQ7QUFBQSxLQUpBO0FBQUEsSUFPQSxNQUFBLENBQUEsSUFBUSxDQUFBLEtBUFIsQ0FBQTtBQUFBLElBUUEsTUFBQSxDQUFBLElBQVEsQ0FBQSxLQVJSLENBQUE7QUFBQSxJQVNBLE1BQUEsQ0FBQSxJQUFRLENBQUEsSUFUUixDQUFBO0FBQUEsSUFVQSwyQ0FBQSxDQVZBLENBRFU7RUFBQSxDQTdLWCxDQUFBOzt1QkFBQTs7R0FGMkIsV0FKNUIsQ0FBQTs7QUFBQSxNQWtNTSxDQUFDLE9BQVAsR0FBaUIsYUFsTWpCLENBQUE7Ozs7QUNBQSxNQUFNLENBQUMsT0FBUCxHQUNDO0FBQUEsRUFBQSxTQUFBLEVBQVcsT0FBQSxDQUFRLGFBQVIsQ0FBWDtBQUFBLEVBQ0EsU0FBQSxFQUFXLE9BQUEsQ0FBUSxhQUFSLENBRFg7QUFBQSxFQUVBLGdCQUFBLEVBQWtCLE9BQUEsQ0FBUSxvQkFBUixDQUZsQjtBQUFBLEVBR0EsaUJBQUEsRUFBbUIsT0FBQSxDQUFRLHFCQUFSLENBSG5CO0FBQUEsRUFJQSxhQUFBLEVBQWUsT0FBQSxDQUFRLGlCQUFSLENBSmY7QUFBQSxFQUtBLFlBQUEsRUFBYyxPQUFBLENBQVEsZ0JBQVIsQ0FMZDtBQUFBLEVBTUEsY0FBQSxFQUFnQixPQUFBLENBQVEsa0JBQVIsQ0FOaEI7Q0FERCxDQUFBOzs7O0FDR0EsUUFBUSxDQUFBLFNBQUUsQ0FBQSxNQUFWLEdBQW1CLFNBQUMsSUFBRCxFQUFPLE1BQVAsR0FBQTtBQUNsQixFQUFBLE1BQU0sQ0FBQyxjQUFQLENBQXNCLElBQUMsQ0FBQSxTQUF2QixFQUFrQyxJQUFsQyxFQUF3QztBQUFBLElBQUMsR0FBQSxFQUFJLE1BQUw7QUFBQSxJQUFhLFlBQUEsRUFBYyxJQUEzQjtHQUF4QyxDQUFBLENBQUE7QUFDQSxTQUFPLElBQVAsQ0FGa0I7QUFBQSxDQUFuQixDQUFBOztBQUFBLFFBSVEsQ0FBQSxTQUFFLENBQUEsTUFBVixHQUFtQixTQUFDLElBQUQsRUFBTyxNQUFQLEdBQUE7QUFDbEIsRUFBQSxNQUFNLENBQUMsY0FBUCxDQUFzQixJQUFDLENBQUEsU0FBdkIsRUFBa0MsSUFBbEMsRUFBd0M7QUFBQSxJQUFDLEdBQUEsRUFBSyxNQUFOO0FBQUEsSUFBYyxZQUFBLEVBQWMsSUFBNUI7R0FBeEMsQ0FBQSxDQUFBO0FBQ0EsU0FBTyxJQUFQLENBRmtCO0FBQUEsQ0FKbkIsQ0FBQTs7QUFBQSxRQVFRLENBQUEsU0FBRSxDQUFBLFFBQVYsR0FBcUIsU0FBQyxJQUFELEVBQU8sR0FBUCxHQUFBO0FBQ3BCLEVBQUEsTUFBTSxDQUFDLGNBQVAsQ0FBc0IsSUFBQyxDQUFBLFNBQXZCLEVBQWtDLElBQWxDLEVBQXdDLEdBQXhDLENBQUEsQ0FBQTtBQUNBLFNBQU8sSUFBUCxDQUZvQjtBQUFBLENBUnJCLENBQUE7O0FBQUEsUUFZUSxDQUFBLFNBQUUsQ0FBQSxNQUFWLEdBQW1CLFNBQUMsSUFBRCxFQUFPLE9BQVAsR0FBQTtBQUNsQixFQUFBLElBQTJCLENBQUEsSUFBRSxDQUFBLFNBQVMsQ0FBQyxPQUF2QztBQUFBLElBQUEsSUFBQyxDQUFBLFNBQVMsQ0FBQyxPQUFYLEdBQXFCLEVBQXJCLENBQUE7R0FBQTtBQUFBLEVBQ0EsSUFBQyxDQUFBLFNBQVMsQ0FBQyxPQUFRLENBQUEsSUFBQSxDQUFuQixHQUEyQixPQUFBLElBQVcsSUFEdEMsQ0FBQTtBQUVBLFNBQU8sSUFBUCxDQUhrQjtBQUFBLENBWm5CLENBQUE7O0FBQUEsTUFrQk0sQ0FBQSxTQUFFLENBQUEsR0FBUixHQUFjLFNBQUMsTUFBRCxFQUFTLElBQVQsR0FBQTtBQUNiLE1BQUEsR0FBQTs7SUFEc0IsT0FBTztHQUM3QjtBQUFBLEVBQUEsR0FBQSxHQUFNLEVBQUEsR0FBSyxJQUFYLENBQUE7QUFDQSxTQUFNLEdBQUcsQ0FBQyxNQUFKLEdBQWEsTUFBbkIsR0FBQTtBQUNDLElBQUEsR0FBQSxHQUFNLElBQUEsR0FBTyxHQUFiLENBREQ7RUFBQSxDQURBO0FBR0EsU0FBTyxHQUFQLENBSmE7QUFBQSxDQWxCZCxDQUFBOzs7O0FDSEEsSUFBQSxjQUFBOztBQUFBLE9BQU8sQ0FBQyxVQUFVLENBQUMsR0FBbkIsR0FDQztBQUFBLEVBQUEsR0FBQSxFQUFLLFNBQUEsR0FBQTtBQUNKLFdBQU8sSUFBQyxDQUFBLEdBQUQsQ0FBSyxPQUFMLENBQVAsQ0FESTtFQUFBLENBQUw7QUFBQSxFQUdBLEdBQUEsRUFBSyxTQUFDLENBQUQsR0FBQTtBQUNKLFdBQU8sSUFBQyxDQUFBLEdBQUQsQ0FBSyxPQUFMLEVBQWMsQ0FBZCxDQUFQLENBREk7RUFBQSxDQUhMO0FBQUEsRUFNQSxLQUFBLEVBQU8sU0FBQSxHQUFBO0FBQ04sSUFBQSxJQUFDLENBQUEsS0FBRCxDQUFPLE9BQVAsQ0FBQSxDQURNO0VBQUEsQ0FOUDtDQURELENBQUE7O0FBQUEsT0FZTyxDQUFDLFVBQVUsQ0FBQyxNQUFuQixHQUNDO0FBQUEsRUFBQSxHQUFBLEVBQUssU0FBQSxHQUFBO0FBQ0osV0FBTyxJQUFDLENBQUEsU0FBRCxDQUFBLENBQVAsQ0FESTtFQUFBLENBQUw7QUFBQSxFQUdBLEdBQUEsRUFBSyxTQUFDLENBQUQsR0FBQTtBQUNKLElBQUEsSUFBZSxDQUFmO0FBQUEsTUFBQSxJQUFDLENBQUEsTUFBRCxDQUFRLENBQVIsQ0FBQSxDQUFBO0tBREk7RUFBQSxDQUhMO0NBYkQsQ0FBQTs7QUFBQSxPQXFCTyxDQUFDLFVBQVUsQ0FBQyxRQUFuQixHQUNDO0FBQUEsRUFBQSxHQUFBLEVBQUssU0FBQSxHQUFBO0FBQ0osV0FBTyxJQUFDLENBQUEsV0FBRCxDQUFBLENBQVAsQ0FESTtFQUFBLENBQUw7QUFBQSxFQUdBLEdBQUEsRUFBSyxTQUFDLEtBQUQsR0FBQTtBQUNKLElBQUEsSUFBQyxDQUFBLEtBQUQsQ0FBTyxLQUFQLENBQUEsQ0FESTtFQUFBLENBSEw7Q0F0QkQsQ0FBQTs7QUFBQSxPQThCTyxDQUFDLFVBQVUsQ0FBQyxRQUFuQixHQUNDO0FBQUEsRUFBQSxHQUFBLEVBQUssU0FBQyxDQUFELEdBQUE7QUFDSixJQUFBLElBQTBCLENBQUUsQ0FBQSxDQUFBLENBQUYsS0FBVSxJQUFwQztBQUFBLE1BQUEsSUFBQyxDQUFBLFFBQUQsQ0FBVSxLQUFWLEVBQWlCLENBQUUsQ0FBQSxDQUFBLENBQW5CLENBQUEsQ0FBQTtLQUFBO0FBQ0EsSUFBQSxJQUE0QixDQUFFLENBQUEsQ0FBQSxDQUFGLEtBQVUsSUFBdEM7QUFBQSxNQUFBLElBQUMsQ0FBQSxRQUFELENBQVUsT0FBVixFQUFtQixDQUFFLENBQUEsQ0FBQSxDQUFyQixDQUFBLENBQUE7S0FEQTtBQUVBLElBQUEsSUFBNkIsQ0FBRSxDQUFBLENBQUEsQ0FBRixLQUFVLElBQXZDO0FBQUEsTUFBQSxJQUFDLENBQUEsUUFBRCxDQUFVLFFBQVYsRUFBb0IsQ0FBRSxDQUFBLENBQUEsQ0FBdEIsQ0FBQSxDQUFBO0tBRkE7QUFHQSxJQUFBLElBQTJCLENBQUUsQ0FBQSxDQUFBLENBQUYsS0FBVSxJQUFyQztBQUFBLE1BQUEsSUFBQyxDQUFBLFFBQUQsQ0FBVSxNQUFWLEVBQWtCLENBQUUsQ0FBQSxDQUFBLENBQXBCLENBQUEsQ0FBQTtLQUpJO0VBQUEsQ0FBTDtDQS9CRCxDQUFBOztBQUFBLE9BdUNPLENBQUMsVUFBVSxDQUFDLEVBQW5CLEdBQ0M7QUFBQSxFQUFBLEdBQUEsRUFBSyxTQUFDLENBQUQsR0FBQTtBQUNKLElBQUEsSUFBQyxDQUFBLFNBQUQsQ0FBVyxDQUFYLENBQUEsQ0FESTtFQUFBLENBQUw7Q0F4Q0QsQ0FBQTs7QUFBQSxPQTZDTyxDQUFDLFNBQVIsQ0FBa0I7QUFBQSxFQUVqQixXQUFBLEVBQWEsU0FBQSxHQUFBO0FBQ1osV0FBTyxJQUFDLENBQUEsUUFBRCxDQUFVLFNBQVYsQ0FBQSxLQUEwQixNQUFqQyxDQURZO0VBQUEsQ0FGSTtBQUFBLEVBTWpCLFNBQUEsRUFBVyxTQUFBLEdBQUE7QUFDVixRQUFBLElBQUE7QUFBQSxJQUFBLENBQUEsR0FBSSxJQUFDLENBQUEsV0FBTCxDQUFBO0FBQUEsSUFDQSxDQUFBLEdBQUksSUFBQyxDQUFBLFlBREwsQ0FBQTtBQUVBLElBQUEsSUFBRyxDQUFBLEtBQUssQ0FBTCxJQUFVLENBQUEsS0FBSyxDQUFsQjtBQUNDLGFBQU8sS0FBUCxDQUREO0tBQUEsTUFFSyxJQUFHLENBQUEsR0FBSSxDQUFKLElBQVMsQ0FBQSxHQUFJLENBQWhCO0FBQ0osYUFBTyxJQUFQLENBREk7S0FBQSxNQUFBO0FBR0osYUFBTyxJQUFDLENBQUEsS0FBSyxDQUFDLE9BQVAsS0FBb0IsTUFBM0IsQ0FISTtLQUxLO0VBQUEsQ0FOTTtBQUFBLEVBaUJqQixNQUFBLEVBQVEsU0FBQSxHQUFBO0FBQ1AsV0FBTyxJQUFLLENBQUcsSUFBQyxDQUFBLFdBQUQsQ0FBQSxDQUFILEdBQXVCLE1BQXZCLEdBQW1DLE1BQW5DLENBQUwsQ0FBQSxDQUFQLENBRE87RUFBQSxDQWpCUztBQUFBLEVBcUJqQixJQUFBLEVBQU0sU0FBQSxHQUFBO0FBRUwsUUFBQSxJQUFBO0FBQUE7QUFBSSxNQUFBLENBQUEsR0FBSSxJQUFDLENBQUEsUUFBRCxDQUFVLFNBQVYsQ0FBSixDQUFKO0tBQUEsY0FBQTtBQUFtQyxNQUFBLFVBQUEsQ0FBbkM7S0FBQTtBQUNBLElBQUEsSUFBRyxDQUFBLEtBQUssTUFBUjtBQUFvQixhQUFPLElBQVAsQ0FBcEI7S0FEQTtBQUVBLFdBQU8sSUFBQyxDQUFBLEtBQUQsQ0FBTywwQkFBUCxFQUFtQyxDQUFBLElBQUssRUFBeEMsQ0FBMkMsQ0FBQyxRQUE1QyxDQUFxRCxTQUFyRCxFQUFnRSxNQUFoRSxDQUFQLENBSks7RUFBQSxDQXJCVztBQUFBLEVBNEJqQixJQUFBLEVBQU0sU0FBQyxPQUFELEdBQUE7QUFDTCxJQUFBLElBQUcsQ0FBQSxPQUFBLElBQVksSUFBQyxDQUFBLFdBQUQsQ0FBQSxDQUFmO0FBQW1DLGFBQU8sSUFBUCxDQUFuQztLQUFBO0FBQUEsSUFDQSxPQUFBLEdBQVUsT0FBQSxJQUFXLElBQUMsQ0FBQSxRQUFELENBQVUsMEJBQVYsQ0FBWCxJQUFvRCxPQUQ5RCxDQUFBO0FBRUEsV0FBTyxJQUFDLENBQUEsUUFBRCxDQUFVLFNBQVYsRUFBd0IsT0FBQSxLQUFXLE1BQWQsR0FBMkIsT0FBM0IsR0FBd0MsT0FBN0QsQ0FBUCxDQUhLO0VBQUEsQ0E1Qlc7QUFBQSxFQWtDakIsVUFBQSxFQUFZLFNBQUMsT0FBRCxHQUFBO0FBQ1gsSUFBQSxJQUFLLENBQUEsQ0FBSSxPQUFILEdBQWdCLE1BQWhCLEdBQTRCLE1BQTdCLENBQUEsQ0FBTCxDQUFBLENBQUEsQ0FEVztFQUFBLENBbENLO0FBQUEsRUF1Q2pCLFdBQUEsRUFBYSxTQUFDLEdBQUQsRUFBTSxPQUFOLEdBQUE7QUFDWixJQUFBLElBQUcsT0FBQSxLQUFXLElBQVgsSUFBbUIsT0FBQSxLQUFXLEtBQWpDO0FBQ0MsTUFBQSxJQUFHLE9BQUEsS0FBVyxJQUFkO0FBQ0MsUUFBQSxJQUFrQixDQUFBLElBQUUsQ0FBQSxRQUFELENBQVUsR0FBVixDQUFuQjtBQUFBLFVBQUEsSUFBQyxDQUFBLFFBQUQsQ0FBVSxHQUFWLENBQUEsQ0FBQTtTQUREO09BQUEsTUFBQTtBQUdDLFFBQUEsSUFBcUIsSUFBQyxDQUFBLFFBQUQsQ0FBVSxHQUFWLENBQXJCO0FBQUEsVUFBQSxJQUFDLENBQUEsV0FBRCxDQUFhLEdBQWIsQ0FBQSxDQUFBO1NBSEQ7T0FERDtLQUFBLE1BQUE7QUFNQyxNQUFBLElBQUcsSUFBQyxDQUFBLFFBQUQsQ0FBVSxHQUFWLENBQUg7QUFDQyxRQUFBLElBQUMsQ0FBQSxXQUFELENBQWEsR0FBYixDQUFBLENBREQ7T0FBQSxNQUFBO0FBR0MsUUFBQSxJQUFDLENBQUEsUUFBRCxDQUFVLEdBQVYsQ0FBQSxDQUhEO09BTkQ7S0FBQTtBQVVBLFdBQU8sSUFBUCxDQVhZO0VBQUEsQ0F2Q0k7QUFBQSxFQXFEakIsU0FBQSxFQUFXLFNBQUMsTUFBRCxFQUFTLEdBQVQsR0FBQTtBQUNWLFdBQU8sSUFBQyxDQUFBLFdBQUQsQ0FBYSxNQUFiLENBQW9CLENBQUMsUUFBckIsQ0FBOEIsR0FBOUIsQ0FBUCxDQURVO0VBQUEsQ0FyRE07QUFBQSxFQXlEakIsUUFBQSxFQUFVLFNBQUMsS0FBRCxHQUFBO0FBQ1QsV0FBTyxJQUFJLENBQUMsY0FBTCxDQUFvQixLQUFwQixDQUEwQixDQUFDLE1BQWxDLENBRFM7RUFBQSxDQXpETztBQUFBLEVBNkRqQixRQUFBLEVBQVUsU0FBQyxRQUFELEdBQUE7QUFDVCxJQUFBLElBQUMsQ0FBQSxZQUFELENBQWUsVUFBZixFQUEyQixRQUFBLElBQVksQ0FBdkMsQ0FBQSxDQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsS0FBRCxDQUFBLENBREEsQ0FEUztFQUFBLENBN0RPO0FBQUEsRUFtRWpCLFFBQUEsRUFBVSxTQUFDLEdBQUQsRUFBTSxPQUFOLEdBQUE7QUFDVCxJQUFBLElBQUcsT0FBSDtBQUNDLE1BQUEsSUFBa0IsQ0FBQSxJQUFFLENBQUEsUUFBRCxDQUFVLEdBQVYsQ0FBbkI7QUFBQSxRQUFBLElBQUMsQ0FBQSxRQUFELENBQVUsR0FBVixDQUFBLENBQUE7T0FERDtLQUFBLE1BQUE7QUFHQyxNQUFBLElBQXFCLElBQUMsQ0FBQSxRQUFELENBQVUsR0FBVixDQUFyQjtBQUFBLFFBQUEsSUFBQyxDQUFBLFdBQUQsQ0FBYSxHQUFiLENBQUEsQ0FBQTtPQUhEO0tBRFM7RUFBQSxDQW5FTztDQUFsQixDQTdDQSxDQUFBOztBQUFBLGNBMEhBLEdBQ0M7QUFBQSxFQUFBLElBQUEsRUFBTSxTQUFDLElBQUQsRUFBTyxJQUFQLEVBQWEsS0FBYixHQUFBO1dBQ0wsSUFBQyxDQUFBLFNBQUQsQ0FBVyxJQUFYLEVBQWlCLElBQWpCLEVBQXVCLEtBQXZCLEVBREs7RUFBQSxDQUFOO0FBQUEsRUFHQSxFQUFBLEVBQUksU0FBQyxJQUFELEVBQU8sRUFBUCxHQUFBO0FBQ0gsSUFBQSxJQUFHLElBQUksQ0FBQyxRQUFMLENBQWMsSUFBZCxDQUFIO2FBQ0MsSUFBQyxDQUFBLFFBQUQsQ0FBVSxJQUFWLEVBQWdCLEVBQWhCLEVBREQ7S0FBQSxNQUFBO2FBR0MsSUFBQyxDQUFBLFNBQUQsQ0FBVyxJQUFYLEVBSEQ7S0FERztFQUFBLENBSEo7QUFBQSxFQVNBLEVBQUEsRUFBSSxTQUFDLElBQUQsRUFBTyxFQUFQLEdBQUE7QUFDSCxJQUFBLElBQUcsSUFBSSxDQUFDLFFBQUwsQ0FBYyxJQUFkLENBQUg7YUFDQyxJQUFDLENBQUEsV0FBRCxDQUFhLElBQWIsRUFBbUIsRUFBbkIsRUFERDtLQUFBLE1BQUE7YUFHQyxJQUFDLENBQUEsWUFBRCxDQUFjLElBQWQsRUFIRDtLQURHO0VBQUEsQ0FUSjtDQTNIRCxDQUFBOztBQUFBLE1BMElNLENBQUMsTUFBUCxDQUFjLE1BQWQsRUFBc0IsY0FBdEIsQ0ExSUEsQ0FBQTs7QUFBQSxNQTJJTSxDQUFDLE1BQVAsQ0FBYyxRQUFkLEVBQXdCLGNBQXhCLENBM0lBLENBQUE7O0FBQUEsT0E0SU8sQ0FBQyxTQUFSLENBQWtCLGNBQWxCLENBNUlBLENBQUE7O0FBQUEsTUE2SU0sQ0FBQyxTQUFQLENBQWlCLGNBQWpCLENBN0lBLENBQUE7O0FBQUEsT0E4SU8sQ0FBQyxTQUFSLENBQWtCLGNBQWxCLENBOUlBLENBQUE7Ozs7QUNBQSxJQUFBLG9CQUFBO0VBQUE7O29CQUFBOztBQUFBLFlBQUEsR0FBZSxPQUFBLENBQVEsUUFBUixDQUFmLENBQUE7O0FBQUE7QUFJQywyQkFBQSxDQUFBOztBQUFBLG1CQUFBLGdCQUFBLEdBQWtCLElBQWxCLENBQUE7O0FBQUEsbUJBQ0EsYUFBQSxHQUFlLElBRGYsQ0FBQTs7QUFBQSxtQkFFQSxNQUFBLEdBQVEsSUFGUixDQUFBOztBQUthLEVBQUEsZ0JBQUEsR0FBQTtBQUNaLElBQUEsSUFBQyxDQUFBLGdCQUFELEdBQW9CLEVBQXBCLENBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxhQUFELEdBQWlCLEVBRGpCLENBQUE7QUFBQSxJQUVBLElBQUMsQ0FBQSxNQUFELEdBQVUsRUFGVixDQURZO0VBQUEsQ0FMYjs7QUFBQSxtQkFXQSxLQUFBLEdBQU8sU0FBQyxJQUFELEdBQUE7QUFDTixJQUFBLElBQUcsQ0FBQSxJQUFFLENBQUEsTUFBTyxDQUFBLElBQUEsQ0FBWjtBQUNDLE1BQUEsSUFBRyxDQUFBLElBQUcsQ0FBQSxJQUFBLENBQU47QUFBaUIsY0FBVSxJQUFBLEtBQUEsQ0FBTyxTQUFBLEdBQVEsSUFBUixHQUFjLDBCQUFkLEdBQXVDLElBQTlDLENBQVYsQ0FBakI7T0FBQTtBQUFBLE1BQ0EsSUFBQyxDQUFBLE1BQU8sQ0FBQSxJQUFBLENBQVIsR0FBZ0IsSUFBRSxDQUFBLElBQUEsQ0FBSyxDQUFDLElBQVIsQ0FBYSxJQUFiLENBRGhCLENBREQ7S0FBQTtBQUdBLFdBQU8sSUFBQyxDQUFBLE1BQU8sQ0FBQSxJQUFBLENBQWYsQ0FKTTtFQUFBLENBWFAsQ0FBQTs7QUFBQSxtQkFrQkEsV0FBQSxHQUFhLFNBQUMsSUFBRCxFQUFPLFFBQVAsR0FBQTtBQUNaLElBQUEsSUFBRyxJQUFJLENBQUMsUUFBTCxDQUFjLFFBQWQsQ0FBSDtBQUFnQyxNQUFBLFFBQUEsR0FBVyxJQUFDLENBQUEsS0FBRCxDQUFPLFFBQVAsQ0FBWCxDQUFoQztLQUFBO0FBQUEsSUFDQSx3Q0FBTSxJQUFOLEVBQVksUUFBWixDQURBLENBRFk7RUFBQSxDQWxCYixDQUFBOztBQUFBLG1CQXdCQSxZQUFBLEdBQWMsU0FBQyxTQUFELEdBQUE7QUFDYixRQUFBLGNBQUE7QUFBQSxTQUFBLGlCQUFBO2lDQUFBO0FBQ0MsTUFBQSxJQUFDLENBQUEsV0FBRCxDQUFhLElBQWIsRUFBbUIsUUFBbkIsQ0FBQSxDQUREO0FBQUEsS0FEYTtFQUFBLENBeEJkLENBQUE7O0FBQUEsbUJBOEJBLGNBQUEsR0FBZ0IsU0FBQyxJQUFELEVBQU8sUUFBUCxHQUFBO0FBQ2YsSUFBQSxJQUFHLElBQUksQ0FBQyxRQUFMLENBQWMsUUFBZCxDQUFIO0FBQWdDLE1BQUEsUUFBQSxHQUFXLElBQUMsQ0FBQSxLQUFELENBQU8sUUFBUCxDQUFYLENBQWhDO0tBQUE7QUFBQSxJQUNBLDJDQUFNLElBQU4sRUFBWSxRQUFaLENBREEsQ0FEZTtFQUFBLENBOUJoQixDQUFBOztBQUFBLG1CQW9DQSxlQUFBLEdBQWlCLFNBQUMsSUFBRCxHQUFBO0FBQ2hCLElBQUEsSUFBQyxDQUFBLGtCQUFELENBQW9CLElBQXBCLENBQUEsQ0FEZ0I7RUFBQSxDQXBDakIsQ0FBQTs7QUFBQSxtQkF5Q0EsRUFBQSxHQUFJLFNBQUMsSUFBRCxFQUFPLFFBQVAsR0FBQTtBQUNILElBQUEsSUFBRyxJQUFJLENBQUMsUUFBTCxDQUFjLElBQWQsQ0FBSDtBQUNDLE1BQUEsSUFBQyxDQUFBLFlBQUQsQ0FBYyxJQUFkLENBQUEsQ0FERDtLQUFBLE1BQUE7QUFHQyxNQUFBLElBQUMsQ0FBQSxXQUFELENBQWEsSUFBYixFQUFtQixRQUFuQixDQUFBLENBSEQ7S0FERztFQUFBLENBekNKLENBQUE7O0FBQUEsbUJBaURBLEVBQUEsR0FBSSxTQUFDLElBQUQsRUFBTyxRQUFQLEdBQUE7QUFDSCxRQUFBLElBQUE7QUFBQSxJQUFBLElBQUcsUUFBSDtBQUNDLE1BQUEsSUFBQyxDQUFBLGNBQUQsQ0FBZ0IsSUFBaEIsRUFBc0IsUUFBdEIsQ0FBQSxDQUREO0tBQUEsTUFBQTtBQUdDLE1BQUEsSUFBRyxJQUFJLENBQUMsUUFBTCxDQUFjLElBQWQsQ0FBSDtBQUNDLGFBQUEsU0FBQTtzQkFBQTtBQUFxQixVQUFBLElBQUMsQ0FBQSxjQUFELENBQWdCLENBQWhCLEVBQW1CLENBQW5CLENBQUEsQ0FBckI7QUFBQSxTQUREO09BQUEsTUFBQTtBQUdDLFFBQUEsSUFBQyxDQUFBLGVBQUQsQ0FBaUIsSUFBakIsQ0FBQSxDQUhEO09BSEQ7S0FERztFQUFBLENBakRKLENBQUE7O0FBQUEsbUJBOERBLGtCQUFBLEdBQW9CLFNBQUMsTUFBRCxFQUFTLElBQVQsRUFBZSxRQUFmLEdBQUE7QUFDbkIsSUFBQSxJQUFHLElBQUksQ0FBQyxRQUFMLENBQWMsUUFBZCxDQUFIO0FBQWdDLE1BQUEsUUFBQSxHQUFXLElBQUMsQ0FBQSxLQUFELENBQU8sUUFBUCxDQUFYLENBQWhDO0tBQUE7QUFBQSxJQUNBLE1BQU0sQ0FBQyxFQUFQLENBQVUsSUFBVixFQUFnQixRQUFoQixDQURBLENBQUE7QUFBQSxJQUVBLElBQUMsQ0FBQSxnQkFBZ0IsQ0FBQyxJQUFsQixDQUNDO0FBQUEsTUFBQSxNQUFBLEVBQVEsTUFBUjtBQUFBLE1BQ0EsSUFBQSxFQUFNLElBRE47QUFBQSxNQUVBLFFBQUEsRUFBVSxRQUZWO0tBREQsQ0FGQSxDQURtQjtFQUFBLENBOURwQixDQUFBOztBQUFBLG1CQXdFQSxtQkFBQSxHQUFxQixTQUFDLE1BQUQsRUFBUyxTQUFULEdBQUE7QUFDcEIsUUFBQSxJQUFBO0FBQUEsU0FBQSxjQUFBO3VCQUFBO0FBQ0MsTUFBQSxJQUFDLENBQUEsa0JBQUQsQ0FBb0IsTUFBcEIsRUFBNEIsQ0FBNUIsRUFBK0IsQ0FBL0IsQ0FBQSxDQUREO0FBQUEsS0FEb0I7RUFBQSxDQXhFckIsQ0FBQTs7QUFBQSxtQkE4RUEsc0JBQUEsR0FBd0IsU0FBQyxNQUFELEVBQVMsSUFBVCxFQUFlLFFBQWYsR0FBQTtBQUN2QixRQUFBLHNDQUFBO0FBQUEsSUFBQSxRQUFBLEdBQVcsRUFBWCxDQUFBO0FBQ0E7QUFBQSxTQUFBLDJDQUFBO21CQUFBO0FBQ0MsTUFBQSxJQUFHLElBQUksQ0FBQyxRQUFMLENBQWMsUUFBZCxDQUFIO0FBQWdDLFFBQUEsUUFBQSxHQUFXLElBQUMsQ0FBQSxLQUFELENBQU8sUUFBUCxDQUFYLENBQWhDO09BQUE7QUFDQSxNQUFBLElBQUcsQ0FBQyxDQUFBLE1BQUEsSUFBVyxDQUFDLENBQUMsTUFBRixLQUFZLE1BQXhCLENBQUEsSUFBbUMsQ0FBQyxDQUFBLElBQUEsSUFBUyxDQUFDLENBQUMsSUFBRixLQUFVLElBQXBCLENBQW5DLElBQWdFLENBQUMsQ0FBQSxRQUFBLElBQWEsQ0FBQyxDQUFDLFFBQUYsS0FBYyxRQUE1QixDQUFuRTtBQUNDLFFBQUEsUUFBUSxDQUFDLElBQVQsQ0FBYyxDQUFkLENBQUEsQ0FERDtPQUZEO0FBQUEsS0FEQTtBQUtBLFNBQUEsaURBQUE7dUJBQUE7QUFDQyxNQUFBLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBVCxDQUFZLENBQUMsQ0FBQyxJQUFkLEVBQW9CLENBQUMsQ0FBQyxRQUF0QixDQUFBLENBQUE7QUFBQSxNQUNBLElBQUMsQ0FBQSxnQkFBZ0IsQ0FBQyxLQUFsQixDQUF3QixDQUF4QixDQURBLENBREQ7QUFBQSxLQU51QjtFQUFBLENBOUV4QixDQUFBOztBQUFBLG1CQTBGQSxHQUFBLEdBQUssU0FBQyxNQUFELEVBQVMsSUFBVCxFQUFlLFFBQWYsR0FBQTtBQUNKLElBQUEsSUFBRyxRQUFIO0FBQ0MsTUFBQSxJQUFDLENBQUEsa0JBQUQsQ0FBb0IsTUFBcEIsRUFBNEIsSUFBNUIsRUFBa0MsUUFBbEMsQ0FBQSxDQUREO0tBQUEsTUFBQTtBQUdDLE1BQUEsSUFBQyxDQUFBLG1CQUFELENBQXFCLE1BQXJCLEVBQTZCLElBQTdCLENBQUEsQ0FIRDtLQURJO0VBQUEsQ0ExRkwsQ0FBQTs7QUFBQSxtQkFrR0EsR0FBQSxHQUFLLFNBQUMsTUFBRCxFQUFTLElBQVQsRUFBZSxRQUFmLEdBQUE7QUFDSixRQUFBLElBQUE7QUFBQSxJQUFBLElBQUcsSUFBSSxDQUFDLFFBQUwsQ0FBYyxJQUFkLENBQUg7QUFDQyxXQUFBLFNBQUE7b0JBQUE7QUFBQSxRQUFBLElBQUMsQ0FBQSxzQkFBRCxDQUF3QixNQUF4QixFQUFnQyxDQUFoQyxFQUFtQyxDQUFuQyxDQUFBLENBQUE7QUFBQSxPQUREO0tBQUEsTUFBQTtBQUdDLE1BQUEsSUFBQyxDQUFBLHNCQUFELENBQXdCLE1BQXhCLEVBQWdDLElBQWhDLEVBQXNDLFFBQXRDLENBQUEsQ0FIRDtLQURJO0VBQUEsQ0FsR0wsQ0FBQTs7QUFBQSxtQkEwR0EsS0FBQSxHQUFPLFNBQUMsR0FBRCxFQUFNLEdBQU4sRUFBVyxJQUFYLEVBQWlCLFFBQWpCLEdBQUE7QUFFTixJQUFBLElBQThCLEdBQTlCO0FBQUEsTUFBQSxJQUFDLENBQUEsR0FBRCxDQUFLLEdBQUwsRUFBVSxJQUFWLEVBQWdCLFFBQWhCLENBQUEsQ0FBQTtLQUFBO0FBQ0EsSUFBQSxJQUE4QixHQUE5QjtBQUFBLE1BQUEsSUFBQyxDQUFBLEdBQUQsQ0FBSyxHQUFMLEVBQVUsSUFBVixFQUFnQixRQUFoQixDQUFBLENBQUE7S0FITTtFQUFBLENBMUdQLENBQUE7O0FBQUEsbUJBaUhBLHdCQUFBLEdBQTBCLFNBQUEsR0FBQTtBQUN6QixJQUFBLElBQUMsQ0FBQSxzQkFBRCxDQUFBLENBQUEsQ0FEeUI7RUFBQSxDQWpIMUIsQ0FBQTs7QUFBQSxtQkF3SEEsV0FBQSxHQUFhLFNBQUMsTUFBRCxFQUFTLE1BQVQsRUFBaUIsTUFBakIsR0FBQTtBQUNaLFFBQUEsMEJBQUE7QUFBQSxJQUFBLFNBQUEsR0FBWSxFQUFaLENBQUE7QUFBQSxJQUNBLE1BQUEsR0FBUyxNQUFBLElBQVUsRUFEbkIsQ0FBQTtBQUVBLFNBQUEsNkNBQUE7eUJBQUE7QUFDQyxNQUFBLFNBQVUsQ0FBQSxLQUFBLENBQVYsR0FBbUIsSUFBQyxDQUFBLFdBQUQsQ0FBYSxLQUFiLEVBQW9CLE1BQXBCLENBQW5CLENBQUE7QUFBQSxNQUNBLE1BQU0sQ0FBQyxXQUFQLENBQW1CLEtBQW5CLEVBQTBCLFNBQVUsQ0FBQSxLQUFBLENBQXBDLENBREEsQ0FERDtBQUFBLEtBRkE7QUFLQSxXQUFPO0FBQUEsTUFDTixNQUFBLEVBQVEsTUFERjtBQUFBLE1BRU4sT0FBQSxFQUFTLFNBQUEsR0FBQTtlQUFNLE1BQU0sQ0FBQyxlQUFQLENBQXVCLFNBQXZCLEVBQU47TUFBQSxDQUZIO0tBQVAsQ0FOWTtFQUFBLENBeEhiLENBQUE7O0FBQUEsbUJBb0lBLFdBQUEsR0FBYSxTQUFDLEtBQUQsRUFBUSxNQUFSLEdBQUE7QUFDWixXQUFPLENBQUEsU0FBQSxLQUFBLEdBQUE7YUFBQSxTQUFBLEdBQUE7QUFDTixZQUFBLElBQUE7QUFBQSxRQURPLDhEQUNQLENBQUE7QUFBQSxRQUFBLElBQUksQ0FBQyxPQUFMLENBQWEsTUFBQSxHQUFPLEtBQXBCLENBQUEsQ0FBQTtlQUNBLEtBQUMsQ0FBQSxJQUFJLENBQUMsS0FBTixDQUFZLEtBQVosRUFBa0IsSUFBbEIsRUFGTTtNQUFBLEVBQUE7SUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQVAsQ0FEWTtFQUFBLENBcEliLENBQUE7O0FBQUEsbUJBMElBLFFBQUEsR0FBVSxTQUFDLE1BQUQsRUFBUyxNQUFULEVBQWlCLE1BQWpCLEdBQUE7QUFDVCxRQUFBLEtBQUE7QUFBQSxJQUFBLEtBQUEsR0FBUSxJQUFDLENBQUEsV0FBRCxDQUFhLE1BQWIsRUFBcUIsTUFBckIsRUFBNkIsTUFBN0IsQ0FBUixDQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsYUFBYSxDQUFDLElBQWYsQ0FDQztBQUFBLE1BQUEsTUFBQSxFQUFRLE1BQVI7QUFBQSxNQUNBLEtBQUEsRUFBTyxLQURQO0tBREQsQ0FEQSxDQURTO0VBQUEsQ0ExSVYsQ0FBQTs7QUFBQSxtQkFrSkEsV0FBQSxHQUFhLFNBQUMsTUFBRCxHQUFBO0FBQ1osUUFBQSwwQ0FBQTtBQUFBLElBQUEsUUFBQSxHQUFXLEVBQVgsQ0FBQTtBQUNBO0FBQUEsU0FBQSwyQ0FBQTt1QkFBQTtBQUNDLE1BQUEsSUFBRyxDQUFBLE1BQUEsSUFBVyxLQUFLLENBQUMsTUFBTixLQUFnQixNQUE5QjtBQUNDLFFBQUEsUUFBUSxDQUFDLElBQVQsQ0FBYyxLQUFkLENBQUEsQ0FERDtPQUREO0FBQUEsS0FEQTtBQUlBLFNBQUEsaURBQUE7MkJBQUE7QUFDQyxNQUFBLEtBQUssQ0FBQyxLQUFLLENBQUMsT0FBWixDQUFBLENBQUEsQ0FBQTtBQUFBLE1BQ0EsSUFBQyxDQUFBLGFBQWEsQ0FBQyxLQUFmLENBQXFCLEtBQXJCLENBREEsQ0FERDtBQUFBLEtBTFk7RUFBQSxDQWxKYixDQUFBOztBQUFBLG1CQTZKQSxLQUFBLEdBQU8sU0FBQyxNQUFELEVBQVMsTUFBVCxFQUFpQixNQUFqQixHQUFBO0FBQ04sSUFBQSxJQUFDLENBQUEsUUFBRCxDQUFVLE1BQVYsRUFBa0IsTUFBbEIsRUFBMEIsTUFBMUIsQ0FBQSxDQURNO0VBQUEsQ0E3SlAsQ0FBQTs7QUFBQSxtQkFrS0EsT0FBQSxHQUFTLFNBQUMsTUFBRCxHQUFBO0FBQ1IsSUFBQSxJQUFDLENBQUEsV0FBRCxDQUFhLE1BQWIsQ0FBQSxDQURRO0VBQUEsQ0FsS1QsQ0FBQTs7QUFBQSxtQkF1S0EscUJBQUEsR0FBdUIsU0FBQSxHQUFBO0FBQ3RCLElBQUEsSUFBQyxDQUFBLFdBQUQsQ0FBQSxDQUFBLENBRHNCO0VBQUEsQ0F2S3ZCLENBQUE7O2dCQUFBOztHQUZvQixhQUZyQixDQUFBOztBQUFBLE1BaUxNLENBQUMsT0FBUCxHQUFpQixNQWpMakIsQ0FBQTs7OztBQ0FBLElBQUEsa0JBQUE7RUFBQTtpU0FBQTs7QUFBQSxNQUFBLEdBQVMsT0FBQSxDQUFRLFVBQVIsQ0FBVCxDQUFBOztBQUFBO0FBS0MsK0JBQUEsQ0FBQTs7QUFBQSx1QkFBQSxRQUFBLEdBQVUsSUFBVixDQUFBOztBQUFBLHVCQUNBLFdBQUEsR0FBYSxLQURiLENBQUE7O0FBQUEsdUJBRUEsVUFBQSxHQUFZLEtBRlosQ0FBQTs7QUFLYSxFQUFBLG9CQUFDLE1BQUQsR0FBQTtBQUNaLElBQUEsMENBQUEsQ0FBQSxDQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsU0FBRCxDQUFXLE1BQVgsQ0FEQSxDQUFBO0FBRUEsVUFBQSxDQUhZO0VBQUEsQ0FMYjs7QUFBQSx1QkFXQSxTQUFBLEdBQVcsU0FBQyxNQUFELEdBQUE7QUFDVixRQUFBLElBQUE7QUFBQSxJQUFBLElBQUcsQ0FBQSxNQUFIO0FBQWdCLFlBQUEsQ0FBaEI7S0FBQTtBQUNBLFNBQUEsV0FBQTtvQkFBQTtBQUF3QixNQUFBLElBQUMsQ0FBQSxXQUFELENBQWEsQ0FBYixFQUFlLENBQWYsQ0FBQSxDQUF4QjtBQUFBLEtBRlU7RUFBQSxDQVhYLENBQUE7O0FBQUEsdUJBaUJBLFdBQUEsR0FBYSxTQUFDLElBQUQsRUFBTyxLQUFQLEdBQUE7QUFDWixJQUFBLElBQW1CLEtBQUEsS0FBVyxNQUE5QjtBQUFBLE1BQUEsSUFBRSxDQUFBLElBQUEsQ0FBRixHQUFVLEtBQVYsQ0FBQTtLQUFBO0FBQ0EsV0FBTyxJQUFQLENBRlk7RUFBQSxDQWpCYixDQUFBOztBQUFBLHVCQXNCQSxHQUFBLEdBQUssU0FBQyxJQUFELEVBQU8sS0FBUCxHQUFBO0FBQ0osSUFBQSxJQUFDLENBQUEsV0FBRCxDQUFhLElBQWIsRUFBbUIsS0FBbkIsQ0FBQSxDQUFBO0FBQ0EsV0FBTyxJQUFQLENBRkk7RUFBQSxDQXRCTCxDQUFBOztBQUFBLHVCQTJCQSxPQUFBLEdBQVMsU0FBQSxHQUFBO0FBQ1IsSUFBQSxJQUFHLElBQUMsQ0FBQSxXQUFKO0FBQXFCLFlBQUEsQ0FBckI7S0FBQTtBQUFBLElBQ0EsSUFBQyxDQUFBLFVBQUQsR0FBYyxJQURkLENBQUE7QUFBQSxJQUVBLElBQUMsQ0FBQSxhQUFELENBQUEsQ0FGQSxDQUFBO0FBQUEsSUFHQSxJQUFDLENBQUEsWUFBRCxDQUFBLENBSEEsQ0FBQTtBQUFBLElBSUEsSUFBQyxDQUFBLFNBQUQsQ0FBQSxDQUpBLENBQUE7QUFBQSxJQUtBLElBQUMsQ0FBQSxVQUFELEdBQWMsS0FMZCxDQUFBO0FBQUEsSUFNQSxJQUFDLENBQUEsV0FBRCxHQUFlLElBTmYsQ0FBQTtBQUFBLElBT0EsSUFBQyxDQUFBLFlBQUQsQ0FBQSxDQVBBLENBRFE7RUFBQSxDQTNCVCxDQUFBOztBQUFBLHVCQXVDQSxZQUFBLEdBQWMsU0FBQSxHQUFBO0FBQ2IsUUFBQSxZQUFBO0FBQUEsU0FBQSxZQUFBOzBCQUFBO0FBQ0MsTUFBQSxJQUFHLElBQUksQ0FBQyxPQUFMLENBQWEsVUFBYixDQUFBLEtBQTRCLENBQS9CO0FBQ0MsUUFBQSxNQUFNLENBQUMsSUFBUCxDQUFZLElBQVosQ0FBQSxDQUREO09BREQ7QUFBQSxLQURhO0VBQUEsQ0F2Q2QsQ0FBQTs7QUFBQSx1QkE4Q0EsUUFBQSxHQUFVLFNBQUEsR0FBQTtBQUNULFdBQU8sSUFBQyxDQUFBLFdBQVcsQ0FBQyxJQUFwQixDQURTO0VBQUEsQ0E5Q1YsQ0FBQTs7QUFBQSx1QkFrREEsYUFBQSxHQUFlLFNBQUEsR0FBQTtBQUNkLElBQUEsSUFBQyxDQUFBLG1CQUFELEdBQXVCLElBQXZCLENBRGM7RUFBQSxDQWxEZixDQUFBOztBQUFBLHVCQXVEQSxTQUFBLEdBQVcsU0FBQSxHQUFBO0FBQ1YsSUFBQSxJQUFDLENBQUEsZUFBRCxHQUFtQixJQUFuQixDQURVO0VBQUEsQ0F2RFgsQ0FBQTs7QUFBQSx1QkE0REEsWUFBQSxHQUFjLFNBQUEsR0FBQTtBQUNiLElBQUEsSUFBQyxDQUFBLGtCQUFELEdBQXNCLElBQXRCLENBRGE7RUFBQSxDQTVEZCxDQUFBOztvQkFBQTs7R0FGd0IsT0FIekIsQ0FBQTs7QUFBQSxVQXVFVSxDQUFDLFNBQVgsR0FBdUIsU0FBQyxJQUFELEVBQU8sTUFBUCxHQUFBO0FBQ3RCLEVBQUEsSUFBQyxDQUFBLFNBQVUsQ0FBQSxJQUFBLENBQVgsR0FBbUIsTUFBbkIsQ0FEc0I7QUFBQSxDQXZFdkIsQ0FBQTs7QUFBQSxNQTRFTSxDQUFDLE9BQVAsR0FBaUIsVUE1RWpCLENBQUE7Ozs7QUNBQSxJQUFBLGtCQUFBOztBQUFBLElBQUksQ0FBQyxNQUFMLENBRUM7QUFBQTtBQUFBOzs7Ozs7Ozs7O0tBQUE7QUFBQSxFQVdBLE9BQUEsRUFBUyxTQUFDLENBQUQsRUFBSSxVQUFKLEdBQUE7V0FDUixDQUFBLEtBQUssSUFBTCxJQUFhLENBQUEsS0FBSyxTQUFsQixJQUFpQyxDQUFDLElBQUksQ0FBQyxPQUFMLENBQWEsQ0FBYixDQUFBLElBQW9CLENBQUEsQ0FBSyxDQUFDLE1BQTNCLENBQWpDLElBQXdFLENBQUksQ0FBQSxVQUFILEdBQXVCLENBQUEsS0FBSyxFQUE1QixHQUFvQyxLQUFyQyxFQURoRTtFQUFBLENBWFQ7QUFlQTtBQUFBOzs7O0tBZkE7QUFBQSxFQW9CQSxPQUFBLEVBQVMsU0FBQyxDQUFELEdBQUE7V0FDUixNQUFNLENBQUEsU0FBRSxDQUFBLFFBQVEsQ0FBQyxJQUFqQixDQUFzQixDQUF0QixDQUFBLEtBQTRCLGlCQURwQjtFQUFBLENBcEJUO0FBd0JBO0FBQUE7Ozs7S0F4QkE7QUFBQSxFQTZCQSxNQUFBLEVBQVEsU0FBQyxDQUFELEdBQUE7V0FDUCxNQUFNLENBQUEsU0FBRSxDQUFBLFFBQVEsQ0FBQyxJQUFqQixDQUFzQixDQUF0QixDQUFBLEtBQTRCLGdCQURyQjtFQUFBLENBN0JSO0FBaUNBO0FBQUE7Ozs7S0FqQ0E7QUFBQSxFQXNDQSxRQUFBLEVBQVUsU0FBQyxDQUFELEdBQUE7V0FDVCxDQUFBLENBQUMsQ0FBRCxJQUFRLE1BQU0sQ0FBQSxTQUFFLENBQUEsUUFBUSxDQUFDLElBQWpCLENBQXNCLENBQXRCLENBQUEsS0FBNEIsa0JBRDNCO0VBQUEsQ0F0Q1Y7QUEwQ0E7QUFBQTs7OztLQTFDQTtBQUFBLEVBK0NBLFdBQUEsRUFBYSxTQUFDLENBQUQsR0FBQTtXQUNaLElBQUksQ0FBQyxRQUFMLENBQWMsQ0FBZCxDQUFBLElBQW9CLElBQUksQ0FBQyxRQUFMLENBQWMsQ0FBZCxDQUFwQixJQUF3QyxJQUFJLENBQUMsU0FBTCxDQUFlLENBQWYsRUFENUI7RUFBQSxDQS9DYjtBQW1EQTtBQUFBOzs7O0tBbkRBO0FBQUEsRUF3REEsUUFBQSxFQUFVLFNBQUMsQ0FBRCxHQUFBO1dBQ1QsTUFBQSxDQUFBLENBQUEsS0FBWSxTQURIO0VBQUEsQ0F4RFY7QUE0REE7QUFBQTs7OztLQTVEQTtBQUFBLEVBaUVBLFNBQUEsRUFBVyxTQUFDLENBQUQsR0FBQTtXQUNWLElBQUksQ0FBQyxRQUFMLENBQWMsQ0FBZCxDQUFBLElBQXFCLENBQUMsQ0FBQSxHQUFJLENBQUosS0FBUyxDQUFWLEVBRFg7RUFBQSxDQWpFWDtBQXFFQTtBQUFBOzs7O0tBckVBO0FBQUEsRUEwRUEsT0FBQSxFQUFTLFNBQUMsQ0FBRCxHQUFBO1dBQ1IsSUFBSSxDQUFDLFFBQUwsQ0FBYyxDQUFkLENBQUEsSUFBcUIsQ0FBQyxJQUFJLENBQUMsSUFBTCxDQUFVLENBQUMsQ0FBQyxRQUFGLENBQUEsQ0FBVixDQUFELEVBRGI7RUFBQSxDQTFFVDtBQThFQTtBQUFBOzs7O0tBOUVBO0FBQUEsRUFtRkEsUUFBQSxFQUFVLFNBQUMsQ0FBRCxHQUFBO1dBQ1QsTUFBQSxDQUFBLENBQUEsS0FBWSxTQURIO0VBQUEsQ0FuRlY7QUF1RkE7QUFBQTs7OztLQXZGQTtBQUFBLEVBNEZBLFNBQUEsRUFBVyxTQUFDLENBQUQsR0FBQTtXQUNWLE1BQUEsQ0FBQSxDQUFBLEtBQVksVUFERjtFQUFBLENBNUZYO0FBZ0dBO0FBQUE7OztLQWhHQTtBQUFBLEVBb0dBLFVBQUEsRUFBWSxTQUFDLENBQUQsR0FBQTtBQUNYLFFBQUEsSUFBQTtBQUFBLElBQUEsQ0FBQSxHQUFJLE1BQUEsQ0FBQSxDQUFKLENBQUE7QUFBQSxJQUNBLENBQUEsR0FBSSxLQURKLENBQUE7QUFFQSxJQUFBLElBQUcsQ0FBQSxJQUFNLENBQUEsS0FBTyxRQUFoQjtBQUNDLE1BQUEsSUFBRyxDQUFBLEtBQUssVUFBUjtBQUNDLFFBQUEsQ0FBQSxHQUFJLENBQUEsWUFBYSxRQUFiLElBQXlCLENBQUEsWUFBYSxjQUExQyxDQUREO09BQUEsTUFBQTtBQUdDLFFBQUEsQ0FBQSxHQUFJLElBQUosQ0FIRDtPQUREO0tBRkE7QUFPQyxJQUFBLElBQUcsQ0FBSDthQUFVLENBQUMsQ0FBQyxNQUFGLEtBQWMsVUFBeEI7S0FBQSxNQUFBO2FBQXlDLE1BQXpDO0tBUlU7RUFBQSxDQXBHWjtBQStHQTtBQUFBOzs7O0tBL0dBO0FBQUEsRUFvSEEsVUFBQSxFQUFZLFNBQUMsQ0FBRCxHQUFBO1dBQ1gsTUFBQSxDQUFBLENBQUEsS0FBWSxXQUREO0VBQUEsQ0FwSFo7QUFBQSxFQXdIQSxVQUFBLEVBQVksU0FBQyxDQUFELEdBQUE7QUFDWCxXQUFPLElBQUMsQ0FBQSxRQUFELENBQVUsQ0FBVixDQUFBLElBQWdCLENBQUMsQ0FBQyxXQUFXLENBQUMsSUFBZCxLQUFzQixRQUE3QyxDQURXO0VBQUEsQ0F4SFo7Q0FGRCxDQUFBLENBQUE7O0FBQUEsTUE4SE0sQ0FBQyxNQUFQLEdBQWdCLFNBQUEsR0FBQTtBQUNmLE1BQUEsdUNBQUE7QUFBQSxFQURnQix5QkFBVSw4REFDMUIsQ0FBQTtBQUFBLE9BQUEsMkNBQUE7bUJBQUE7QUFDQyxJQUFBLElBQUcsQ0FBQSxHQUFIO0FBQWEsZUFBYjtLQUFBO0FBQ0EsU0FBQSxVQUFBO3FCQUFBO0FBQ0MsTUFBQSxJQUFHLFFBQVMsQ0FBQSxHQUFBLENBQVQsS0FBaUIsTUFBakIsSUFBOEIsUUFBUyxDQUFBLEdBQUEsQ0FBVCxLQUFpQixJQUFsRDtBQUNDLFFBQUEsUUFBUyxDQUFBLEdBQUEsQ0FBVCxHQUFnQixHQUFJLENBQUEsR0FBQSxDQUFwQixDQUREO09BREQ7QUFBQSxLQUZEO0FBQUEsR0FBQTtBQUtBLFNBQU8sUUFBUCxDQU5lO0FBQUEsQ0E5SGhCLENBQUE7O0FBQUEsS0F1SUssQ0FBQyxTQUFOLENBQWdCO0FBQUEsRUFFZixNQUFBLEVBQVEsU0FBQyxLQUFELEVBQVEsSUFBUixHQUFBO0FBQ1AsSUFBQSxJQUFDLENBQUEsTUFBRCxDQUFRLEtBQVIsRUFBZSxDQUFmLEVBQWtCLElBQWxCLENBQUEsQ0FETztFQUFBLENBRk87QUFBQSxFQU1mLE9BQUEsRUFBUyxTQUFBLEdBQUE7QUFDUixRQUFBLGNBQUE7QUFBQSxTQUFBLDJDQUFBO3NCQUFBO0FBQXNCLE1BQUEsSUFBRyxJQUFJLENBQUMsT0FBUjtBQUFxQixRQUFBLElBQUksQ0FBQyxPQUFMLENBQUEsQ0FBQSxDQUFyQjtPQUF0QjtBQUFBLEtBRFE7RUFBQSxDQU5NO0NBQWhCLENBdklBLENBQUE7O0FBb0pBO0FBQUE7Ozs7Ozs7R0FwSkE7O0FBQUEsQ0E0SkMsU0FBQSxHQUFBO0FBQ0EsTUFBQSx3Q0FBQTtBQUFBLEVBQUEsUUFBQSxHQUFXLEVBQVgsQ0FBQTtBQUFBLEVBQ0EsV0FBQSxHQUFjLFNBQUMsSUFBRCxHQUFBO0FBQ2IsSUFBQSxRQUFRLENBQUMsSUFBVCxDQUNDO0FBQUEsTUFBQSxJQUFBLEVBQU0sQ0FBSyxJQUFLLENBQUEsQ0FBQSxDQUFMLEtBQVcsR0FBWCxJQUFrQixJQUFLLENBQUEsQ0FBQSxDQUFMLEtBQVcsR0FBakMsR0FBMkMsUUFBQSxDQUFTLElBQUksQ0FBQyxLQUFMLENBQUEsQ0FBQSxHQUFlLENBQXhCLEVBQTJCLENBQTNCLENBQTNDLEdBQThFLENBQS9FLENBQU47QUFBQSxNQUNBLElBQUEsRUFBTSxJQUROO0tBREQsQ0FBQSxDQURhO0VBQUEsQ0FEZCxDQUFBO0FBQUEsRUFRQSxPQUFBLEdBQVUsU0FBQyxNQUFELEVBQVMsSUFBVCxHQUFBO0FBQ1QsUUFBQSxnQkFBQTtBQUFBLElBQUEsR0FBQSxHQUFNLE1BQU4sQ0FBQTtBQUNBLFNBQUEsMkNBQUE7bUJBQUE7QUFBbUIsTUFBQSxHQUFBLEdBQU0sR0FBSSxDQUFBLENBQUEsQ0FBVixDQUFuQjtBQUFBLEtBREE7QUFFQSxXQUFPLEdBQVAsQ0FIUztFQUFBLENBUlYsQ0FBQTtBQUFBLEVBY0EsUUFBQSxHQUFXLFNBQUMsQ0FBRCxFQUFJLENBQUosR0FBQTtBQUNWLFFBQUEsMEJBQUE7QUFBQSxTQUFBLCtDQUFBOzBCQUFBO0FBQ0MsTUFBQSxJQUFBLEdBQU8sT0FBQSxDQUFRLENBQVIsRUFBVyxJQUFJLENBQUMsSUFBaEIsQ0FBUCxDQUFBO0FBQUEsTUFDQSxJQUFBLEdBQU8sT0FBQSxDQUFRLENBQVIsRUFBVyxJQUFJLENBQUMsSUFBaEIsQ0FEUCxDQUFBO0FBRUEsTUFBQSxJQUFHLElBQUEsR0FBTyxJQUFWO0FBQW9CLGVBQU8sSUFBSSxDQUFDLElBQVosQ0FBcEI7T0FGQTtBQUdBLE1BQUEsSUFBRyxJQUFBLEdBQU8sSUFBVjtBQUFvQixlQUFPLENBQUEsSUFBSyxDQUFDLElBQWIsQ0FBcEI7T0FKRDtBQUFBLEtBRFU7RUFBQSxDQWRYLENBQUE7QUFBQSxFQXNCQSxLQUFLLENBQUMsU0FBTixDQUFnQixRQUFoQixFQUEwQixTQUFBLEdBQUE7QUFDekIsUUFBQSxtQkFBQTtBQUFBLElBRDBCLDhEQUMxQixDQUFBO0FBQUEsSUFBQSxRQUFRLENBQUMsS0FBVCxDQUFBLENBQUEsQ0FBQTtBQUNBLFNBQUEsMkNBQUE7cUJBQUE7QUFDQyxNQUFBLElBQUcsTUFBQSxDQUFPLEdBQVAsQ0FBQSxLQUFlLE9BQWxCO0FBQ0MsUUFBQSxXQUFBLENBQVksR0FBWixDQUFBLENBREQ7T0FBQSxNQUFBO0FBR0MsUUFBQSxXQUFBLENBQVksR0FBRyxDQUFDLEtBQUosQ0FBVSxhQUFWLENBQVosQ0FBQSxDQUhEO09BREQ7QUFBQSxLQURBO0FBTUEsV0FBTyxJQUFDLENBQUEsSUFBRCxDQUFNLFFBQU4sQ0FBUCxDQVB5QjtFQUFBLENBQTFCLENBdEJBLENBREE7QUFBQSxDQUFELENBQUEsQ0FBQSxDQTVKQSxDQUFBOzs7O0FDQUEsTUFBTSxDQUFDLE9BQVAsR0FDQztBQUFBLEVBQUEsTUFBQSxFQUFRLE9BQUEsQ0FBUSxVQUFSLENBQVI7QUFBQSxFQUNBLE1BQUEsRUFBUSxPQUFBLENBQVEsVUFBUixDQURSO0NBREQsQ0FBQTs7OztBQ0FBLElBQUEsUUFBQTs7QUFBQTt3QkFFQzs7QUFBQSxxQkFBQSxRQUFBLEdBQVUsZUFBVixDQUFBOztBQUFBLHFCQUNBLGNBQUEsR0FBZ0IsY0FEaEIsQ0FBQTs7QUFBQSxxQkFFQSxTQUFBLEdBQVcsbUNBRlgsQ0FBQTs7QUFBQSxxQkFHQSxNQUFBLEdBQVEseUJBSFIsQ0FBQTs7QUFBQSxxQkFNQSxNQUFBLEdBQVEsU0FBQyxLQUFELEVBQVEsUUFBUixHQUFBO0FBQ1AsUUFBQSxxQ0FBQTtBQUFBLElBQUEsSUFBRyxJQUFJLENBQUMsUUFBTCxDQUFjLEtBQWQsQ0FBSDtBQUNDLE1BQUEsSUFBRyxDQUFDLE9BQUEsR0FBVSxLQUFLLENBQUMsS0FBTixDQUFZLElBQUMsQ0FBQSxRQUFiLENBQVgsQ0FBSDtBQUNDLFFBQUEsS0FBQSxHQUFRLElBQUMsQ0FBQSxNQUFELENBQVEsSUFBQyxDQUFBLFVBQUQsQ0FBWSxRQUFRLENBQUMsTUFBckIsRUFBNkIsT0FBUSxDQUFBLENBQUEsQ0FBckMsQ0FBUixFQUFrRCxRQUFsRCxDQUFSLENBREQ7T0FBQSxNQUdLLElBQUcsQ0FBQyxPQUFBLEdBQVUsS0FBSyxDQUFDLEtBQU4sQ0FBWSxJQUFDLENBQUEsY0FBYixDQUFYLENBQUg7QUFDSixhQUFBLDhDQUFBOzhCQUFBO0FBQ0MsVUFBQSxLQUFBLEdBQVEsS0FBSyxDQUFDLE9BQU4sQ0FBYyxLQUFkLEVBQXFCLElBQUMsQ0FBQSxNQUFELENBQVEsS0FBUixFQUFlLFFBQWYsQ0FBckIsQ0FBUixDQUREO0FBQUEsU0FESTtPQUpOO0tBQUEsTUFRSyxJQUFHLElBQUksQ0FBQyxRQUFMLENBQWMsS0FBZCxDQUFIO0FBQ0osV0FBQSxhQUFBOzRCQUFBO0FBQ0MsUUFBQSxLQUFNLENBQUEsSUFBQSxDQUFOLEdBQWMsSUFBQyxDQUFBLE1BQUQsQ0FBUSxLQUFSLEVBQWUsUUFBZixDQUFkLENBREQ7QUFBQSxPQURJO0tBUkw7QUFhQSxXQUFPLEtBQVAsQ0FkTztFQUFBLENBTlIsQ0FBQTs7QUFBQSxxQkF1QkEsWUFBQSxHQUFjLFNBQUMsT0FBRCxFQUFVLElBQVYsRUFBZ0IsUUFBaEIsR0FBQTtBQUNiLFFBQUEsdUZBQUE7QUFBQSxJQUFBLElBQUcsSUFBSSxDQUFDLE9BQUwsQ0FBYSxJQUFiLENBQUg7QUFDQyxNQUFBLE1BQUEsR0FBUyxJQUFULENBQUE7QUFBQSxNQUNBLElBQUEsR0FBTyxNQUFNLENBQUMsS0FBUCxDQUFBLENBRFAsQ0FBQTtBQUFBLE1BRUEsU0FBQSxHQUFZLElBQUMsQ0FBQSxZQUFELENBQWMsTUFBZCxFQUFzQixRQUF0QixDQUZaLENBREQ7S0FBQTtBQUtBLElBQUEsSUFBRyxDQUFDLE9BQUEsR0FBVSxJQUFJLENBQUMsS0FBTCxDQUFXLElBQUMsQ0FBQSxNQUFaLENBQVgsQ0FBSDtBQUNDLE1BQUEsVUFBQSxHQUFhLE9BQVEsQ0FBQSxDQUFBLENBQXJCLENBQUE7QUFBQSxNQUNBLFNBQUEsR0FBWSxPQUFRLENBQUEsQ0FBQSxDQURwQixDQUFBO0FBQUEsTUFFQSxJQUFBLEdBQU8sT0FBUSxDQUFBLENBQUEsQ0FGZixDQUFBO0FBQUEsTUFHQSxRQUFBLEdBQWMsSUFBSCxHQUFhLElBQUMsQ0FBQSxZQUFELENBQWMsSUFBZCxFQUFvQixRQUFwQixDQUFiLEdBQWdELEVBSDNELENBQUE7QUFJQSxXQUFBLCtEQUFBOzhCQUFBO0FBQ0MsUUFBQSxJQUFHLEdBQUEsS0FBTyxHQUFQLElBQWUsU0FBUyxDQUFDLE1BQVYsR0FBaUIsQ0FBbkM7QUFDQyxVQUFBLFFBQVMsQ0FBQSxLQUFBLENBQVQsR0FBa0IsU0FBUyxDQUFDLEtBQVYsQ0FBQSxDQUFsQixDQUREO1NBREQ7QUFBQSxPQUpBO0FBT0EsTUFBQSxJQUFHLFVBQUg7QUFDQyxRQUFBLE9BQVEsQ0FBQSxTQUFBLENBQVIsR0FBcUIsUUFBUyxDQUFBLENBQUEsQ0FBOUIsQ0FERDtPQUFBLE1BQUE7QUFHQyxRQUFBLElBQUcsQ0FBQSxPQUFTLENBQUEsU0FBQSxDQUFaO0FBQ0MsZ0JBQVUsSUFBQSxLQUFBLENBQU8sb0JBQUEsR0FBbUIsU0FBbkIsR0FBOEIsZ0JBQTlCLEdBQTZDLE9BQU8sQ0FBQyxXQUFXLENBQUMsSUFBakUsR0FBdUUsMEJBQTlFLENBQVYsQ0FERDtTQUFBO0FBQUEsUUFFQSxPQUFRLENBQUEsU0FBQSxDQUFVLENBQUMsS0FBbkIsQ0FBeUIsT0FBekIsRUFBa0MsUUFBbEMsQ0FGQSxDQUhEO09BUkQ7S0FOYTtFQUFBLENBdkJkLENBQUE7O0FBQUEscUJBOENBLFlBQUEsR0FBYyxTQUFDLElBQUQsRUFBTyxRQUFQLEdBQUE7QUFDYixRQUFBLHlFQUFBO0FBQUEsSUFBQSxNQUFBLEdBQVMsRUFBVCxDQUFBO0FBQ0EsSUFBQSxJQUFHLElBQUksQ0FBQyxRQUFMLENBQWMsSUFBZCxDQUFIO0FBQ0MsTUFBQSxJQUFBLEdBQU8sSUFBSSxDQUFDLEtBQUwsQ0FBVyxHQUFYLENBQVAsQ0FERDtLQURBO0FBR0EsU0FBQSwyQ0FBQTtxQkFBQTtBQUNDLE1BQUEsSUFBRyxDQUFBLElBQUssQ0FBQyxRQUFMLENBQWMsR0FBZCxDQUFKO0FBQ0MsUUFBQSxNQUFNLENBQUMsSUFBUCxDQUFZLEdBQVosQ0FBQSxDQUFBO0FBQ0EsaUJBRkQ7T0FBQTtBQUFBLE1BSUEsS0FBQSxHQUFRLElBQUMsQ0FBQSxNQUFELENBQVEsR0FBUixFQUFhLFFBQWIsQ0FKUixDQUFBO0FBS0EsTUFBQSxJQUFHLENBQUEsSUFBSyxDQUFDLFFBQUwsQ0FBYyxLQUFkLENBQUo7QUFDQyxRQUFBLE1BQU0sQ0FBQyxJQUFQLENBQVksS0FBWixDQUFBLENBQUE7QUFDQSxpQkFGRDtPQUxBO0FBQUEsTUFVQSxPQUFBLEdBQVUsS0FBSyxDQUFDLEtBQU4sQ0FBWSxJQUFDLENBQUEsU0FBYixDQVZWLENBQUE7QUFXQSxNQUFBLElBQUcsQ0FBQSxPQUFIO0FBQ0MsUUFBQSxNQUFNLENBQUMsSUFBUCxDQUFZLEtBQVosQ0FBQSxDQUFBO0FBQ0EsaUJBRkQ7T0FYQTtBQUFBLE1BZUEsSUFBQSxHQUFPLE9BQVEsQ0FBQSxDQUFBLENBZmYsQ0FBQTtBQUFBLE1BZ0JBLEVBQUEsR0FBSyxPQUFRLENBQUEsQ0FBQSxDQUFSLElBQWMsSUFoQm5CLENBQUE7QUFBQSxNQWlCQSxNQUFBLEdBQVMsT0FBUSxDQUFBLENBQUEsQ0FBUixJQUFjLElBakJ2QixDQUFBO0FBQUEsTUFrQkEsTUFBQSxHQUFTLE9BQVEsQ0FBQSxDQUFBLENBQVIsSUFBYyxJQWxCdkIsQ0FBQTtBQUFBLE1BbUJBLFFBQUEsR0FBVyxRQUFRLENBQUMsR0FBVCxDQUFhLElBQWIsQ0FuQlgsQ0FBQTtBQXFCQSxNQUFBLElBQUcsQ0FBQSxFQUFIO0FBQ0MsUUFBQSxNQUFNLENBQUMsSUFBUCxDQUFZLFFBQVosQ0FBQSxDQUREO09BQUEsTUFBQTtBQUdDLFFBQUEsSUFBRyxDQUFBLFFBQVUsQ0FBQSxFQUFBLENBQWI7QUFDQyxnQkFBVSxJQUFBLEtBQUEsQ0FBTyxtQkFBQSxHQUFrQixFQUFsQixHQUFzQixjQUF0QixHQUFtQyxJQUFuQyxHQUF5QyxNQUF6QyxHQUE4QyxRQUFRLENBQUMsV0FBVyxDQUFDLElBQW5FLEdBQXlFLHlCQUFoRixDQUFWLENBREQ7U0FBQTtBQUVBLFFBQUEsSUFBRyxDQUFBLE1BQUg7QUFDQyxVQUFBLE1BQU0sQ0FBQyxJQUFQLENBQVksQ0FBQSxTQUFBLEtBQUEsR0FBQTttQkFBQSxTQUFBLEdBQUE7cUJBQUssUUFBUyxDQUFBLEVBQUEsQ0FBRyxDQUFDLElBQWIsQ0FBa0IsUUFBbEIsRUFBTDtZQUFBLEVBQUE7VUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQVosQ0FBQSxDQUREO1NBQUEsTUFFSyxJQUFHLENBQUEsSUFBSDtBQUNKLFVBQUEsTUFBTSxDQUFDLElBQVAsQ0FBWSxRQUFTLENBQUEsRUFBQSxDQUFHLENBQUMsSUFBYixDQUFrQixRQUFsQixDQUFaLENBQUEsQ0FESTtTQUFBLE1BQUE7QUFHSixVQUFBLE1BQU0sQ0FBQyxJQUFQLENBQVksUUFBUyxDQUFBLEVBQUEsQ0FBRyxDQUFDLEtBQWIsQ0FBbUIsUUFBbkIsRUFBNkIsSUFBQyxDQUFBLFlBQUQsQ0FBYyxNQUFkLEVBQXNCLFFBQXRCLENBQTdCLENBQVosQ0FBQSxDQUhJO1NBUE47T0F0QkQ7QUFBQSxLQUhBO0FBcUNBLFdBQU8sTUFBUCxDQXRDYTtFQUFBLENBOUNkLENBQUE7O0FBQUEscUJBdUZBLFVBQUEsR0FBWSxTQUFDLE1BQUQsRUFBUyxPQUFULEdBQUE7QUFDWCxRQUFBLEdBQUE7QUFBQSxJQUFBLEdBQUEsR0FBTSxPQUFPLENBQUMsT0FBUixDQUFnQixHQUFoQixDQUFOLENBQUE7QUFDQSxJQUFBLElBQUcsR0FBQSxHQUFNLENBQVQ7QUFDQyxNQUFBLE9BQUEsR0FBVSxJQUFDLENBQUEsVUFBRCxDQUFZLE1BQU8sQ0FBQSxPQUFPLENBQUMsTUFBUixDQUFlLENBQWYsRUFBa0IsR0FBbEIsQ0FBQSxDQUFuQixFQUE0QyxPQUFPLENBQUMsTUFBUixDQUFlLEdBQUEsR0FBSSxDQUFuQixDQUE1QyxDQUFWLENBREQ7S0FBQSxNQUVLLElBQUcsTUFBQSxJQUFVLE1BQU8sQ0FBQSxPQUFBLENBQVAsS0FBcUIsTUFBbEM7QUFDSixNQUFBLE9BQUEsR0FBVSxNQUFPLENBQUEsT0FBQSxDQUFqQixDQURJO0tBQUEsTUFBQTtBQUdKLE1BQUEsT0FBQSxHQUFVLElBQVYsQ0FISTtLQUhMO0FBT0EsV0FBTyxPQUFQLENBUlc7RUFBQSxDQXZGWixDQUFBOztrQkFBQTs7SUFGRCxDQUFBOztBQUFBLE1BcUdNLENBQUMsT0FBUCxHQUFpQixHQUFBLENBQUEsUUFyR2pCLENBQUE7Ozs7QUNBQSxJQUFBLDJCQUFBOztBQUFBLE9BQUEsR0FBVSxPQUFBLENBQVEsV0FBUixDQUFWLENBQUE7O0FBQUEsUUFDQSxHQUFXLE9BQUEsQ0FBUSxZQUFSLENBRFgsQ0FBQTs7QUFBQTtBQU1DLHFCQUFBLE1BQUEsR0FBUSxJQUFSLENBQUE7O0FBQUEscUJBQ0EsT0FBQSxHQUFTLElBRFQsQ0FBQTs7QUFBQSxxQkFFQSxRQUFBLEdBQVUsSUFGVixDQUFBOztBQUFBLHFCQUdBLE9BQUEsR0FBUyxJQUhULENBQUE7O0FBS2EsRUFBQSxrQkFBRSxNQUFGLEdBQUE7QUFDWixJQURhLElBQUMsQ0FBQSwwQkFBQSxTQUFTLEVBQ3ZCLENBQUE7QUFBQSxJQUFBLElBQUMsQ0FBQSxPQUFELEdBQVcsRUFBWCxDQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsUUFBRCxHQUFZLEVBRFosQ0FBQTtBQUFBLElBRUEsSUFBQyxDQUFBLE9BQUQsR0FBVyxFQUZYLENBQUE7QUFBQSxJQUdBLElBQUMsQ0FBQSxHQUFELENBQUssVUFBTCxFQUFpQixJQUFqQixDQUhBLENBQUE7QUFJQSxJQUFBLElBQUcsQ0FBQSxJQUFFLENBQUEsTUFBTSxDQUFDLFNBQVo7QUFBMkIsTUFBQSxJQUFDLENBQUEsTUFBTSxDQUFDLFNBQVIsR0FBb0IsS0FBcEIsQ0FBM0I7S0FMWTtFQUFBLENBTGI7O0FBQUEscUJBYUEsTUFBQSxHQUFRLFNBQUMsSUFBRCxFQUFPLEtBQVAsRUFBYyxFQUFkLEdBQUE7QUFDUCxRQUFBLE9BQUE7O01BRHFCLEtBQUs7S0FDMUI7QUFBQSxJQUFBLElBQUcsSUFBQyxDQUFBLFFBQVMsQ0FBQSxJQUFBLENBQVYsSUFBbUIsSUFBQyxDQUFBLE9BQVEsQ0FBQSxJQUFBLENBQS9CO0FBQ0MsWUFBVSxJQUFBLEtBQUEsQ0FBTyxVQUFBLEdBQVMsSUFBVCxHQUFlLGlCQUF0QixDQUFWLENBREQ7S0FBQTtBQUFBLElBRUEsT0FBQSxHQUFjLElBQUEsT0FBQSxDQUFRLElBQVIsRUFBYyxJQUFkLEVBQW9CLEtBQXBCLEVBQTJCLEVBQTNCLENBRmQsQ0FBQTtBQUFBLElBR0EsSUFBQyxDQUFBLE9BQVEsQ0FBQSxJQUFBLENBQVQsR0FBaUIsT0FIakIsQ0FBQTtBQUlBLFdBQU8sSUFBQyxDQUFBLE9BQVEsQ0FBQSxJQUFBLENBQWhCLENBTE87RUFBQSxDQWJSLENBQUE7O0FBQUEscUJBcUJBLEdBQUEsR0FBSyxTQUFDLElBQUQsR0FBQTtBQUNKLElBQUEsSUFBRyxDQUFBLElBQUUsQ0FBQSxRQUFTLENBQUEsSUFBQSxDQUFYLElBQW9CLENBQUEsSUFBRSxDQUFBLE9BQVEsQ0FBQSxJQUFBLENBQWpDO0FBQ0MsWUFBVSxJQUFBLEtBQUEsQ0FBTyxvQkFBQSxHQUFtQixJQUFuQixHQUF5QixZQUFoQyxDQUFWLENBREQ7S0FBQTtBQUVBLElBQUEsSUFBRyxDQUFBLElBQUUsQ0FBQSxRQUFTLENBQUEsSUFBQSxDQUFkO0FBQ0MsTUFBQSxJQUFDLENBQUEsUUFBUyxDQUFBLElBQUEsQ0FBVixHQUFrQixJQUFDLENBQUEsT0FBUSxDQUFBLElBQUEsQ0FBSyxDQUFDLE1BQWYsQ0FBQSxDQUFsQixDQUREO0tBRkE7QUFJQSxXQUFPLElBQUMsQ0FBQSxRQUFTLENBQUEsSUFBQSxDQUFqQixDQUxJO0VBQUEsQ0FyQkwsQ0FBQTs7QUFBQSxxQkE2QkEsTUFBQSxHQUFRLFNBQUMsSUFBRCxHQUFBO0FBQ1AsSUFBQSxJQUFHLENBQUEsSUFBRSxDQUFBLE9BQVEsQ0FBQSxJQUFBLENBQWI7QUFDQyxZQUFVLElBQUEsS0FBQSxDQUFPLG9CQUFBLEdBQW1CLElBQW5CLEdBQXlCLFlBQWhDLENBQVYsQ0FERDtLQUFBO0FBRUEsV0FBTyxJQUFDLENBQUEsT0FBUSxDQUFBLElBQUEsQ0FBaEIsQ0FITztFQUFBLENBN0JSLENBQUE7O0FBQUEscUJBbUNBLEdBQUEsR0FBSyxTQUFDLElBQUQsRUFBTyxPQUFQLEdBQUE7QUFDSixJQUFBLElBQUcsSUFBQyxDQUFBLFFBQVMsQ0FBQSxJQUFBLENBQVYsSUFBbUIsSUFBQyxDQUFBLE9BQVEsQ0FBQSxJQUFBLENBQS9CO0FBQ0MsWUFBVSxJQUFBLEtBQUEsQ0FBTyxVQUFBLEdBQVMsSUFBVCxHQUFlLGlCQUF0QixDQUFWLENBREQ7S0FBQTtBQUFBLElBRUEsSUFBQyxDQUFBLFFBQVMsQ0FBQSxJQUFBLENBQVYsR0FBa0IsT0FGbEIsQ0FBQTtBQUdBLFdBQU8sSUFBUCxDQUpJO0VBQUEsQ0FuQ0wsQ0FBQTs7QUFBQSxxQkEwQ0EsR0FBQSxHQUFLLFNBQUMsSUFBRCxHQUFBO0FBQ0osV0FBTyxJQUFDLENBQUEsUUFBUyxDQUFBLElBQUEsQ0FBVixJQUFtQixJQUFDLENBQUEsT0FBUSxDQUFBLElBQUEsQ0FBbkMsQ0FESTtFQUFBLENBMUNMLENBQUE7O0FBQUEscUJBOENBLFNBQUEsR0FBVyxTQUFDLElBQUQsRUFBTyxPQUFQLEdBQUE7QUFDVixJQUFBLElBQUMsQ0FBQSxPQUFRLENBQUEsSUFBQSxDQUFULEdBQWlCLE9BQWpCLENBQUE7QUFDQSxXQUFPLElBQVAsQ0FGVTtFQUFBLENBOUNYLENBQUE7O0FBQUEscUJBbURBLFNBQUEsR0FBVyxTQUFDLElBQUQsR0FBQTtBQUNWLFdBQU8sSUFBQyxDQUFBLE9BQVEsQ0FBQSxJQUFBLENBQVQsS0FBb0IsTUFBM0IsQ0FEVTtFQUFBLENBbkRYLENBQUE7O0FBQUEscUJBdURBLE1BQUEsR0FBUSxTQUFDLElBQUQsR0FBQTtBQUNQLElBQUEsSUFBRyxDQUFBLElBQUUsQ0FBQSxPQUFRLENBQUEsSUFBQSxDQUFiO0FBQ0MsWUFBVSxJQUFBLEtBQUEsQ0FBTyxvQkFBQSxHQUFtQixJQUFuQixHQUF5QixjQUFoQyxDQUFWLENBREQ7S0FBQTtBQUVBLFdBQU8sSUFBQyxDQUFBLE9BQVEsQ0FBQSxJQUFBLENBQUssQ0FBQyxNQUFmLENBQUEsQ0FBUCxDQUhPO0VBQUEsQ0F2RFIsQ0FBQTs7QUFBQSxxQkE2REEsY0FBQSxHQUFnQixTQUFDLEtBQUQsRUFBUSxPQUFSLEVBQXNCLE9BQXRCLEdBQUE7QUFFZixRQUFBLGtEQUFBOztNQUZ1QixVQUFVO0tBRWpDOztNQUZxQyxVQUFVO0tBRS9DO0FBQUEsU0FBQSxlQUFBOzRCQUFBO0FBQ0MsTUFBQSxPQUFRLENBQUEsSUFBQSxDQUFSLEdBQWdCLFFBQVEsQ0FBQyxZQUFULENBQXNCLEtBQXRCLEVBQTZCLElBQTdCLENBQW1DLENBQUEsQ0FBQSxDQUFuRCxDQUREO0FBQUEsS0FBQTtBQUlBLElBQUEsSUFBRyxLQUFLLENBQUMsU0FBUyxDQUFDLE9BQW5CO0FBQ0M7QUFBQSxXQUFBLGdCQUFBO3FDQUFBO0FBQ0MsUUFBQSxPQUFRLENBQUEsUUFBQSxDQUFSLEdBQW9CLElBQUMsQ0FBQSxHQUFELENBQUssV0FBTCxDQUFwQixDQUREO0FBQUEsT0FERDtLQUpBO0FBU0EsSUFBQSxJQUFHLE9BQUg7QUFDQyxNQUFBLElBQUcsSUFBSSxDQUFDLFFBQUwsQ0FBYyxPQUFkLENBQUg7QUFDQyxRQUFBLE9BQUEsR0FBVSxRQUFRLENBQUMsWUFBVCxDQUFzQixPQUF0QixFQUErQixJQUEvQixDQUFxQyxDQUFBLENBQUEsQ0FBL0MsQ0FERDtPQUFBO0FBRUEsTUFBQSxJQUFHLElBQUksQ0FBQyxVQUFMLENBQWdCLE9BQWhCLENBQUg7QUFDQyxRQUFBLFFBQUEsR0FBVyxPQUFBLENBQVEsT0FBUixDQUFYLENBREQ7T0FIRDtLQUFBLE1BQUE7QUFNQyxNQUFBLFFBQUEsR0FBZSxJQUFBLEtBQUEsQ0FBTSxPQUFOLENBQWYsQ0FORDtLQVRBO0FBa0JBLElBQUEsSUFBRyxDQUFBLENBQUEsUUFBQSxZQUFxQixLQUFyQixDQUFIO0FBQ0MsWUFBVSxJQUFBLEtBQUEsQ0FBTyxrREFBQSxHQUFpRCxLQUFLLENBQUMsSUFBdkQsR0FBNkQsb0JBQTdELEdBQWdGLFFBQVEsQ0FBQyxXQUFXLENBQUMsSUFBNUcsQ0FBVixDQUREO0tBbEJBO0FBc0JBLFdBQU8sUUFBUCxDQXhCZTtFQUFBLENBN0RoQixDQUFBOztrQkFBQTs7SUFORCxDQUFBOztBQUFBLE1BK0ZNLENBQUMsT0FBUCxHQUFpQixRQS9GakIsQ0FBQTs7OztBQ0FBLElBQUEsMkJBQUE7O0FBQUEsUUFBQSxHQUFXLE9BQUEsQ0FBUSxZQUFSLENBQVgsQ0FBQTs7QUFBQTtBQUlDLDhCQUFBLE1BQUEsR0FBUSxJQUFSLENBQUE7O0FBQUEsOEJBQ0EsUUFBQSxHQUFVLElBRFYsQ0FBQTs7QUFJYSxFQUFBLDJCQUFBLEdBQUE7QUFDWixJQUFBLElBQUMsQ0FBQSxNQUFELEdBQVUsRUFBVixDQURZO0VBQUEsQ0FKYjs7QUFBQSw4QkFRQSxJQUFBLEdBQU0sU0FBQSxHQUFBLENBUk4sQ0FBQTs7QUFBQSw4QkFZQSxTQUFBLEdBQVcsU0FBQyxNQUFELEdBQUE7QUFDVixJQUFBLE1BQU0sQ0FBQyxLQUFQLENBQWEsSUFBQyxDQUFBLE1BQWQsRUFBc0IsUUFBUSxDQUFDLE1BQVQsQ0FBZ0IsTUFBaEIsRUFBd0IsSUFBQyxDQUFBLFFBQXpCLENBQXRCLENBQUEsQ0FEVTtFQUFBLENBWlgsQ0FBQTs7MkJBQUE7O0lBSkQsQ0FBQTs7QUFBQSxNQXFCTSxDQUFDLE9BQVAsR0FBaUIsaUJBckJqQixDQUFBOzs7O0FDQUEsSUFBQSxtQ0FBQTs7QUFBQSxRQUFBLEdBQVcsT0FBQSxDQUFRLFlBQVIsQ0FBWCxDQUFBOztBQUFBLFFBQ0EsR0FBVyxPQUFBLENBQVEsWUFBUixDQURYLENBQUE7O0FBQUE7QUFNQyw0QkFBQSxNQUFBLEdBQVEsSUFBUixDQUFBOztBQUFBLDRCQUNBLFVBQUEsR0FBWSxJQURaLENBQUE7O0FBSWEsRUFBQSx5QkFBQSxHQUFBO0FBQ1osSUFBQSxJQUFDLENBQUEsTUFBRCxHQUNDO0FBQUEsTUFBQSxNQUFBLEVBQ0M7QUFBQSxRQUFBLE9BQUEsRUFBUyxFQUFUO09BREQ7S0FERCxDQUFBO0FBQUEsSUFHQSxJQUFDLENBQUEsVUFBRCxHQUFjLEVBSGQsQ0FEWTtFQUFBLENBSmI7O0FBQUEsNEJBV0EsWUFBQSxHQUFjLFNBQUMsSUFBRCxFQUFPLFNBQVAsR0FBQTtBQUNiLElBQUEsSUFBQyxDQUFBLFVBQVcsQ0FBQSxJQUFBLENBQVosR0FBb0IsU0FBcEIsQ0FEYTtFQUFBLENBWGQsQ0FBQTs7QUFBQSw0QkFnQkEsU0FBQSxHQUFXLFNBQUMsTUFBRCxHQUFBO0FBQ1YsSUFBQSxNQUFNLENBQUMsS0FBUCxDQUFhLElBQUMsQ0FBQSxNQUFkLEVBQXNCLE1BQXRCLENBQUEsQ0FEVTtFQUFBLENBaEJYLENBQUE7O0FBQUEsNEJBcUJBLGNBQUEsR0FBZ0IsU0FBQSxHQUFBO0FBQ2YsUUFBQSw0RkFBQTtBQUFBLElBQUEsUUFBQSxHQUFlLElBQUEsUUFBQSxDQUFTLElBQUMsQ0FBQSxNQUFNLENBQUMsTUFBakIsQ0FBZixDQUFBO0FBQUEsSUFDQSxRQUFRLENBQUMsTUFBVCxDQUFnQixRQUFRLENBQUMsTUFBekIsRUFBaUMsUUFBakMsQ0FEQSxDQUFBO0FBR0E7QUFBQSxTQUFBLFlBQUE7NkJBQUE7QUFDQyxNQUFBLElBQUMsQ0FBQSxZQUFELENBQWMsSUFBZCxFQUF3QixJQUFBLFNBQUEsQ0FBQSxDQUF4QixDQUFBLENBREQ7QUFBQSxLQUhBO0FBTUE7QUFBQSxTQUFBLGFBQUE7d0JBQUE7QUFDQyxNQUFBLEdBQUcsQ0FBQyxRQUFKLEdBQWUsUUFBZixDQUFBO0FBQUEsTUFDQSxHQUFHLENBQUMsSUFBSixDQUFBLENBREEsQ0FERDtBQUFBLEtBTkE7QUFVQTtBQUFBLFNBQUEsYUFBQTt3QkFBQTtBQUNDLE1BQUEsSUFBMEMsSUFBQyxDQUFBLE1BQU8sQ0FBQSxJQUFBLENBQWxEO0FBQUEsUUFBQSxHQUFHLENBQUMsU0FBSixDQUFjLElBQUMsQ0FBQSxNQUFPLENBQUEsSUFBQSxDQUF0QixFQUE2QixRQUE3QixDQUFBLENBQUE7T0FERDtBQUFBLEtBVkE7QUFhQTtBQUFBLFNBQUEsYUFBQTt3QkFBQTtBQUNDLE1BQUEsSUFBd0IsR0FBRyxDQUFDLEtBQTVCO0FBQUEsUUFBQSxHQUFHLENBQUMsS0FBSixDQUFVLFFBQVYsQ0FBQSxDQUFBO09BREQ7QUFBQSxLQWJBO0FBZ0JBLElBQUEsSUFBRyxJQUFDLENBQUEsTUFBTSxDQUFDLFFBQVg7QUFBeUI7QUFBQSxXQUFBLGFBQUE7OEJBQUE7QUFDeEIsUUFBQSxJQUFHLENBQUEsUUFBUyxDQUFDLFNBQVQsQ0FBbUIsSUFBbkIsQ0FBSjtBQUNDLFVBQUEsVUFBQSxHQUFhLFFBQVEsQ0FBQyxNQUFULENBQWdCLElBQWhCLEVBQXNCLE9BQU8sQ0FBQyxJQUE5QixDQUFiLENBREQ7U0FBQSxNQUFBO0FBR0MsVUFBQSxVQUFBLEdBQWEsUUFBUSxDQUFDLE1BQVQsQ0FBZ0IsSUFBaEIsQ0FBYixDQUhEO1NBQUE7QUFJQSxRQUFBLElBQUcsT0FBTyxDQUFDLE9BQVg7QUFDQyxVQUFBLFVBQVUsQ0FBQyxVQUFYLENBQXNCLE9BQU8sQ0FBQyxPQUE5QixDQUFBLENBREQ7U0FKQTtBQU1BLFFBQUEsSUFBRyxPQUFPLENBQUMsS0FBWDtBQUNDLFVBQUEsVUFBVSxDQUFDLEtBQVgsQ0FBaUIsT0FBTyxDQUFDLEtBQXpCLENBQUEsQ0FERDtTQU5BO0FBUUEsUUFBQSxJQUFHLE9BQU8sQ0FBQyxPQUFYO0FBQ0MsVUFBQSxVQUFVLENBQUMsTUFBWCxDQUFrQixPQUFPLENBQUMsT0FBMUIsQ0FBQSxDQUREO1NBUkE7QUFVQSxRQUFBLElBQUcsT0FBTyxDQUFDLE1BQVg7QUFDQyxVQUFBLFVBQVUsQ0FBQyxTQUFYLENBQXFCLElBQXJCLENBQUEsQ0FERDtTQVh3QjtBQUFBLE9BQXpCO0tBaEJBO0FBOEJBO0FBQUEsU0FBQSxhQUFBO3dCQUFBO0FBQ0MsTUFBQSxJQUF5QixHQUFHLENBQUMsTUFBN0I7QUFBQSxRQUFBLEdBQUcsQ0FBQyxNQUFKLENBQVcsUUFBWCxDQUFBLENBQUE7T0FERDtBQUFBLEtBOUJBO0FBaUNBLFdBQU8sUUFBUCxDQWxDZTtFQUFBLENBckJoQixDQUFBOzt5QkFBQTs7SUFORCxDQUFBOztBQUFBLE1BZ0VNLENBQUMsT0FBUCxHQUFpQixlQWhFakIsQ0FBQTs7OztBQ0FBLElBQUEsaUJBQUE7O0FBQUEsUUFBQSxHQUFXLE9BQUEsQ0FBUSxZQUFSLENBQVgsQ0FBQTs7QUFBQTtBQUtDLG9CQUFBLFFBQUEsR0FBVSxJQUFWLENBQUE7O0FBQUEsb0JBQ0EsSUFBQSxHQUFNLElBRE4sQ0FBQTs7QUFBQSxvQkFFQSxLQUFBLEdBQU8sSUFGUCxDQUFBOztBQUFBLG9CQUdBLE1BQUEsR0FBUSxJQUhSLENBQUE7O0FBQUEsb0JBSUEsT0FBQSxHQUFTLElBSlQsQ0FBQTs7QUFBQSxvQkFLQSxPQUFBLEdBQVMsSUFMVCxDQUFBOztBQUFBLG9CQU1BLE1BQUEsR0FBUSxLQU5SLENBQUE7O0FBU2EsRUFBQSxpQkFBRSxRQUFGLEVBQWEsSUFBYixFQUFvQixLQUFwQixFQUEyQixRQUEzQixHQUFBO0FBQ1osSUFEYSxJQUFDLENBQUEsV0FBQSxRQUNkLENBQUE7QUFBQSxJQUR3QixJQUFDLENBQUEsT0FBQSxJQUN6QixDQUFBO0FBQUEsSUFEK0IsSUFBQyxDQUFBLFFBQUEsS0FDaEMsQ0FBQTs7TUFEdUMsV0FBVztLQUNsRDtBQUFBLElBQUEsSUFBQyxDQUFBLE1BQUQsR0FBVSxFQUFWLENBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxPQUFELEdBQVcsRUFEWCxDQUFBO0FBRUEsSUFBQSxJQUEwQixRQUExQjtBQUFBLE1BQUEsSUFBQyxDQUFBLE1BQU0sQ0FBQyxJQUFSLENBQWEsUUFBYixDQUFBLENBQUE7S0FIWTtFQUFBLENBVGI7O0FBQUEsb0JBZUEsTUFBQSxHQUFRLFNBQUEsR0FBQTtBQUNQLFFBQUEsK0JBQUE7QUFBQSxJQUFBLFFBQUEsR0FBVyxJQUFDLENBQUEsUUFBUSxDQUFDLGNBQVYsQ0FBeUIsSUFBQyxDQUFBLEtBQTFCLEVBQWlDLElBQUMsQ0FBQSxPQUFsQyxFQUEyQyxJQUFDLENBQUEsT0FBNUMsQ0FBWCxDQUFBO0FBQ0E7QUFBQSxTQUFBLDJDQUFBO3VCQUFBO0FBQ0MsTUFBQSxLQUFBLENBQU0sUUFBTixFQUFnQixJQUFDLENBQUEsUUFBakIsQ0FBQSxDQUREO0FBQUEsS0FEQTtBQUdBLFdBQU8sUUFBUCxDQUpPO0VBQUEsQ0FmUixDQUFBOztBQUFBLG9CQXNCQSxRQUFBLEdBQVUsU0FBRSxLQUFGLEdBQUE7QUFDVCxJQURVLElBQUMsQ0FBQSxRQUFBLEtBQ1gsQ0FBQTtBQUFBLFdBQU8sSUFBUCxDQURTO0VBQUEsQ0F0QlYsQ0FBQTs7QUFBQSxvQkEwQkEsVUFBQSxHQUFZLFNBQUUsT0FBRixHQUFBO0FBQ1gsSUFEWSxJQUFDLENBQUEsVUFBQSxPQUNiLENBQUE7QUFBQSxXQUFPLElBQVAsQ0FEVztFQUFBLENBMUJaLENBQUE7O0FBQUEsb0JBOEJBLFNBQUEsR0FBVyxTQUFDLElBQUQsR0FBQTs7TUFBQyxPQUFPO0tBQ2xCO0FBQUEsSUFBQSxJQUFDLENBQUEsUUFBUSxDQUFDLFNBQVYsQ0FBb0IsSUFBQSxJQUFNLElBQUMsQ0FBQSxJQUEzQixFQUFpQyxJQUFDLENBQUEsSUFBbEMsQ0FBQSxDQUFBO0FBQ0EsV0FBTyxJQUFQLENBRlU7RUFBQSxDQTlCWCxDQUFBOztBQUFBLG9CQW1DQSxLQUFBLEdBQU8sU0FBQyxNQUFELEdBQUE7QUFDTixJQUFBLElBQUcsSUFBSSxDQUFDLFVBQUwsQ0FBZ0IsTUFBaEIsQ0FBSDtBQUNDLE1BQUEsSUFBQyxDQUFBLE1BQU0sQ0FBQyxJQUFSLENBQWEsTUFBYixDQUFBLENBREQ7S0FBQSxNQUVLLElBQUcsSUFBSSxDQUFDLE9BQUwsQ0FBYSxNQUFiLENBQUg7QUFDSixNQUFBLElBQUMsQ0FBQSxNQUFNLENBQUMsSUFBUixDQUFhLElBQUMsQ0FBQSxXQUFELENBQWEsTUFBYixDQUFiLENBQUEsQ0FESTtLQUFBLE1BQUE7QUFHSixNQUFBLElBQUMsQ0FBQSxNQUFNLENBQUMsSUFBUixDQUFhLElBQUMsQ0FBQSxXQUFELENBQWEsS0FBSyxDQUFDLElBQU4sQ0FBVyxTQUFYLENBQWIsQ0FBYixDQUFBLENBSEk7S0FGTDtBQU1BLFdBQU8sSUFBUCxDQVBNO0VBQUEsQ0FuQ1AsQ0FBQTs7QUFBQSxvQkE2Q0EsTUFBQSxHQUFRLFNBQUMsSUFBRCxFQUFPLEtBQVAsR0FBQTtBQUNQLFFBQUEsSUFBQTtBQUFBLElBQUEsSUFBRyxJQUFJLENBQUMsUUFBTCxDQUFjLElBQWQsQ0FBSDtBQUNDLE1BQUEsSUFBRyxLQUFBLEtBQVcsTUFBZDtBQUNDLFFBQUEsSUFBQyxDQUFBLE9BQVEsQ0FBQSxJQUFBLENBQVQsR0FBaUIsS0FBakIsQ0FERDtPQUFBLE1BQUE7QUFHQyxRQUFBLE1BQUEsQ0FBQSxJQUFRLENBQUEsT0FBUSxDQUFBLElBQUEsQ0FBaEIsQ0FIRDtPQUREO0tBQUEsTUFLSyxJQUFHLElBQUksQ0FBQyxRQUFMLENBQWMsSUFBZCxDQUFIO0FBQ0osV0FBQSxTQUFBO29CQUFBO0FBQ0MsUUFBQSxJQUFDLENBQUEsTUFBRCxDQUFRLENBQVIsRUFBVSxDQUFWLENBQUEsQ0FERDtBQUFBLE9BREk7S0FMTDtBQVFBLFdBQU8sSUFBUCxDQVRPO0VBQUEsQ0E3Q1IsQ0FBQTs7QUFBQSxvQkF5REEsV0FBQSxHQUFhLFNBQUMsTUFBRCxHQUFBO0FBQ1osV0FBTyxDQUFBLFNBQUEsS0FBQSxHQUFBO2FBQUEsU0FBQyxPQUFELEVBQVUsUUFBVixHQUFBO0FBQ04sWUFBQSxlQUFBO0FBQUEsYUFBQSw2Q0FBQTs2QkFBQTtBQUNDLFVBQUEsUUFBUSxDQUFDLFlBQVQsQ0FBc0IsT0FBdEIsRUFBK0IsS0FBL0IsRUFBc0MsUUFBdEMsQ0FBQSxDQUREO0FBQUEsU0FETTtNQUFBLEVBQUE7SUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQVAsQ0FEWTtFQUFBLENBekRiLENBQUE7O2lCQUFBOztJQUxELENBQUE7O0FBQUEsTUFzRU0sQ0FBQyxPQUFQLEdBQWlCLE9BdEVqQixDQUFBOzs7O0FDQUEsTUFBTSxDQUFDLE9BQVAsR0FFQztBQUFBLEVBQUEsUUFBQSxFQUFVLE9BQUEsQ0FBUSxZQUFSLENBQVY7QUFBQSxFQUNBLGVBQUEsRUFBaUIsT0FBQSxDQUFRLG1CQUFSLENBRGpCO0FBQUEsRUFFQSxpQkFBQSxFQUFtQixPQUFBLENBQVEscUJBQVIsQ0FGbkI7Q0FGRCxDQUFBOzs7O0FDQUEsSUFBQSw0QkFBQTs7QUFBQSxhQUFBLEdBQWdCLE9BQUEsQ0FBUSxpQkFBUixDQUFoQixDQUFBOztBQUFBO0FBS0MsMEJBQUEsUUFBQSxHQUFVLElBQVYsQ0FBQTs7QUFBQSwwQkFDQSxPQUFBLEdBQVMsSUFEVCxDQUFBOztBQUlhLEVBQUEsdUJBQUMsT0FBRCxHQUFBOztNQUFDLFVBQVU7S0FDdkI7QUFBQSxJQUFBLElBQUMsQ0FBQSxPQUFELEdBQVcsT0FBWCxDQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsUUFBRCxHQUFZLFFBRFosQ0FBQTtBQUVBLFVBQUEsQ0FIWTtFQUFBLENBSmI7O0FBQUEsMEJBVUEsR0FBQSxHQUFLLFNBQUMsR0FBRCxFQUFNLEtBQU4sRUFBYSxPQUFiLEdBQUE7QUFDSixJQUFBLElBQUMsQ0FBQSxNQUFELENBQVEsR0FBUixFQUFhLE9BQWIsQ0FBcUIsQ0FBQyxLQUF0QixDQUE0QixLQUE1QixDQUFBLENBQUE7QUFDQSxXQUFPLElBQVAsQ0FGSTtFQUFBLENBVkwsQ0FBQTs7QUFBQSwwQkFlQSxHQUFBLEdBQUssU0FBQyxHQUFELEVBQU0sR0FBTixHQUFBO0FBQ0osV0FBTyxJQUFDLENBQUEsTUFBRCxDQUFRLEdBQVIsQ0FBWSxDQUFDLElBQWIsQ0FBQSxDQUFBLElBQXVCLEdBQTlCLENBREk7RUFBQSxDQWZMLENBQUE7O0FBQUEsMEJBbUJBLE1BQUEsR0FBUSxTQUFDLEdBQUQsRUFBTSxPQUFOLEdBQUE7QUFDUCxJQUFBLElBQUMsQ0FBQSxHQUFELENBQUssR0FBTCxFQUFVLElBQVYsRUFBZ0IsTUFBTSxDQUFDLEtBQVAsQ0FBYTtBQUFBLE1BQUMsUUFBQSxFQUFVLENBQUEsQ0FBWDtLQUFiLEVBQTZCLE9BQTdCLENBQWhCLENBQUEsQ0FBQTtBQUNBLFdBQU8sSUFBUCxDQUZPO0VBQUEsQ0FuQlIsQ0FBQTs7QUFBQSwwQkF3QkEsTUFBQSxHQUFRLFNBQUMsR0FBRCxFQUFNLE9BQU4sR0FBQTtBQUNQLFFBQUEsTUFBQTtBQUFBLElBQUEsTUFBQSxHQUFhLElBQUEsTUFBQSxDQUFPLEdBQVAsRUFBWSxNQUFNLENBQUMsS0FBUCxDQUFhLEVBQWIsRUFBaUIsSUFBQyxDQUFBLE9BQWxCLEVBQTJCLE9BQTNCLENBQVosQ0FBYixDQUFBO0FBQUEsSUFDQSxNQUFNLENBQUMsT0FBTyxDQUFDLFFBQWYsR0FBMEIsSUFBQyxDQUFBLFFBRDNCLENBQUE7QUFFQSxXQUFPLE1BQVAsQ0FITztFQUFBLENBeEJSLENBQUE7O0FBQUEsMEJBOEJBLE9BQUEsR0FBUyxTQUFDLElBQUQsRUFBTyxPQUFQLEdBQUE7QUFDUixXQUFXLElBQUEsYUFBQSxDQUFjLElBQWQsRUFBb0IsSUFBcEIsRUFBMEIsT0FBMUIsQ0FBWCxDQURRO0VBQUEsQ0E5QlQsQ0FBQTs7dUJBQUE7O0lBTEQsQ0FBQTs7QUFBQSxNQXVDTSxDQUFDLE9BQVAsR0FBaUIsYUF2Q2pCLENBQUE7Ozs7QUNBQSxJQUFBLGFBQUE7O0FBQUE7QUFFQywwQkFBQSxNQUFBLEdBQVEsSUFBUixDQUFBOztBQUFBLDBCQUNBLElBQUEsR0FBTSxJQUROLENBQUE7O0FBQUEsMEJBRUEsT0FBQSxHQUFTLElBRlQsQ0FBQTs7QUFBQSwwQkFHQSxLQUFBLEdBQU8sSUFIUCxDQUFBOztBQU1hLEVBQUEsdUJBQUMsTUFBRCxFQUFTLElBQVQsRUFBZSxPQUFmLEdBQUE7QUFDWixJQUFBLElBQUMsQ0FBQSxNQUFELEdBQVUsTUFBVixDQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsSUFBRCxHQUFRLElBRFIsQ0FBQTtBQUFBLElBRUEsSUFBQyxDQUFBLE9BQUQsR0FBVyxPQUZYLENBQUE7QUFBQSxJQUdBLElBQUMsQ0FBQSxLQUFELEdBQVMsSUFBSSxDQUFDLE1BQUwsQ0FBWSxNQUFNLENBQUMsR0FBUCxDQUFXLElBQVgsQ0FBQSxJQUFvQixJQUFoQyxFQUFzQyxJQUF0QyxDQUhULENBQUE7QUFJQSxVQUFBLENBTFk7RUFBQSxDQU5iOztBQUFBLDBCQWNBLElBQUEsR0FBTSxTQUFBLEdBQUE7QUFDTCxRQUFBLEtBQUE7QUFBQSxJQUFBLEtBQUEsR0FBUSxJQUFJLENBQUMsTUFBTCxDQUFZLElBQUMsQ0FBQSxLQUFiLENBQVIsQ0FBQTtBQUNBLElBQUEsSUFBRyxDQUFBLEtBQUEsSUFBYSxLQUFLLENBQUMsTUFBTixHQUFlLElBQS9CO0FBQ0MsYUFBTyxLQUFQLENBREQ7S0FBQSxNQUFBO0FBR0MsTUFBQSxJQUFHLEtBQUEsS0FBUyxJQUFaO0FBQ0MsUUFBQSxJQUFDLENBQUEsTUFBTSxDQUFDLE1BQVIsQ0FBZSxJQUFDLENBQUEsSUFBaEIsQ0FBQSxDQUREO09BQUEsTUFBQTtBQUdDLFFBQUEsSUFBQyxDQUFBLE1BQU0sQ0FBQyxHQUFSLENBQVksSUFBQyxDQUFBLElBQWIsRUFBbUIsS0FBbkIsRUFBMEIsSUFBQyxDQUFBLE9BQTNCLENBQUEsQ0FIRDtPQUFBO0FBSUEsYUFBTyxJQUFQLENBUEQ7S0FGSztFQUFBLENBZE4sQ0FBQTs7QUFBQSwwQkEwQkEsR0FBQSxHQUFLLFNBQUMsSUFBRCxFQUFPLEtBQVAsR0FBQTtBQUNKLElBQUEsSUFBRyxLQUFBLEtBQVMsSUFBWjtBQUNDLE1BQUEsTUFBQSxDQUFBLElBQVEsQ0FBQSxLQUFNLENBQUEsSUFBQSxDQUFkLENBREQ7S0FBQSxNQUFBO0FBR0MsTUFBQSxJQUFDLENBQUEsS0FBTSxDQUFBLElBQUEsQ0FBUCxHQUFlLEtBQWYsQ0FIRDtLQUFBO0FBSUEsV0FBTyxJQUFQLENBTEk7RUFBQSxDQTFCTCxDQUFBOztBQUFBLDBCQWtDQSxHQUFBLEdBQUssU0FBQyxJQUFELEVBQU8sR0FBUCxHQUFBO0FBQ0osV0FBTyxDQUFJLElBQUMsQ0FBQSxLQUFLLENBQUMsY0FBUCxDQUFzQixJQUF0QixDQUFILEdBQW9DLElBQUMsQ0FBQSxLQUFNLENBQUEsSUFBQSxDQUEzQyxHQUFzRCxHQUF2RCxDQUFQLENBREk7RUFBQSxDQWxDTCxDQUFBOztBQUFBLDBCQXNDQSxHQUFBLEdBQUssU0FBQyxJQUFELEdBQUE7QUFDSixXQUFPLElBQUMsQ0FBQSxLQUFLLENBQUMsY0FBUCxDQUFzQixJQUF0QixDQUFQLENBREk7RUFBQSxDQXRDTCxDQUFBOztBQUFBLDBCQTBDQSxJQUFBLEdBQU0sU0FBQyxRQUFELEdBQUE7QUFDTCxXQUFPLE1BQU0sQ0FBQyxJQUFQLENBQVksSUFBQyxDQUFBLEtBQWIsRUFBb0IsUUFBcEIsQ0FBUCxDQURLO0VBQUEsQ0ExQ04sQ0FBQTs7dUJBQUE7O0lBRkQsQ0FBQTs7QUFBQSxNQWdETSxDQUFDLE9BQVAsR0FBaUIsYUFoRGpCLENBQUE7Ozs7QUNBQSxJQUFBLFdBQUE7RUFBQTtpU0FBQTs7QUFBQTtBQUVDLGdDQUFBLENBQUE7O0FBQUEsd0JBQUEsT0FBQSxHQUFTLElBQVQsQ0FBQTs7QUFHYSxFQUFBLHFCQUFDLE9BQUQsR0FBQTs7TUFBQyxVQUFVO0tBQ3ZCO0FBQUEsSUFBQSxPQUFPLENBQUMsSUFBUixHQUFlLE9BQU8sQ0FBQyxJQUFSLElBQWdCLE1BQS9CLENBQUE7QUFBQSxJQUNBLDZDQUFNLE1BQU0sQ0FBQyxLQUFQLENBQWEsT0FBYixFQUFzQjtBQUFBLE1BQUMsSUFBQSxFQUFNLEVBQVA7S0FBdEIsQ0FBTixDQURBLENBQUE7QUFBQSxJQUVBLElBQUMsQ0FBQSxJQUFELENBQUEsQ0FGQSxDQUFBO0FBR0EsVUFBQSxDQUpZO0VBQUEsQ0FIYjs7QUFBQSx3QkFVQSxJQUFBLEdBQU0sU0FBQSxHQUFBO0FBQ0wsSUFBQSxJQUFHLElBQUMsQ0FBQSxPQUFPLENBQUMsSUFBVCxLQUFpQixNQUFwQjtBQUNDLE1BQUEsSUFBQyxDQUFBLFNBQUQsQ0FBVyxRQUFYLEVBQXFCLGtCQUFyQixDQUFBLENBQUE7QUFBQSxNQUNBLElBQUMsQ0FBQSxTQUFELENBQVcsV0FBWCxFQUF3QixNQUF4QixDQURBLENBREQ7S0FESztFQUFBLENBVk4sQ0FBQTs7QUFBQSx3QkFpQkEsT0FBQSxHQUFTLFNBQUMsSUFBRCxHQUFBO0FBQ1IsUUFBQSxTQUFBO0FBQUEsSUFBQSxJQUFHLElBQUMsQ0FBQSxPQUFPLENBQUMsSUFBVCxLQUFpQixNQUFwQjtBQUNDO0FBQ0MsUUFBQSxJQUFBLEdBQU8sSUFBSSxDQUFDLE1BQUwsQ0FBWSxJQUFaLEVBQWtCLElBQUMsQ0FBQSxPQUFPLENBQUMsTUFBM0IsQ0FBUCxDQUFBO0FBQUEsUUFDQSxJQUFDLENBQUEsUUFBUSxDQUFDLElBQVYsR0FBaUIsSUFEakIsQ0FERDtPQUFBLGNBQUE7QUFJQyxRQURLLFlBQ0wsQ0FBQTtBQUFBLFFBQUEsSUFBQyxDQUFBLElBQUQsQ0FBTSxPQUFOLEVBQWUsR0FBZixFQUFvQixJQUFwQixFQUEwQixJQUFJLENBQUMsR0FBL0IsQ0FBQSxDQUFBO0FBQUEsUUFDQSxJQUFDLENBQUEsU0FBRCxDQUFBLENBREEsQ0FBQTtBQUVBLGNBQUEsQ0FORDtPQUFBO0FBQUEsTUFPQSxJQUFDLENBQUEsU0FBRCxDQUFXLElBQVgsRUFBaUIsSUFBakIsQ0FQQSxDQUREO0tBQUEsTUFBQTtBQVVDLE1BQUEsSUFBQyxDQUFBLFNBQUQsQ0FBVyxJQUFYLENBQUEsQ0FWRDtLQURRO0VBQUEsQ0FqQlQsQ0FBQTs7QUFBQSx3QkFnQ0EsSUFBQSxHQUFNLFNBQUMsT0FBRCxHQUFBOztNQUFDLFVBQVU7S0FDaEI7QUFBQSxJQUFBLElBQUcsSUFBQyxDQUFBLE9BQUo7QUFDQyxNQUFBLE9BQU8sQ0FBQyxJQUFSLEdBQWUsTUFBTSxDQUFDLEtBQVAsQ0FBYSxFQUFiLEVBQWlCLElBQUMsQ0FBQSxPQUFPLENBQUMsTUFBMUIsRUFBa0MsT0FBTyxDQUFDLElBQVIsSUFBZ0IsSUFBQyxDQUFBLE9BQU8sQ0FBQyxJQUEzRCxDQUFmLENBQUE7QUFBQSxNQUNBLHNDQUFNLE9BQU4sQ0FEQSxDQUREO0tBQUEsTUFBQTtBQUlDLE1BQUEsT0FBTyxDQUFDLElBQVIsR0FBZSxNQUFNLENBQUMsS0FBUCxDQUFhLEVBQWIsRUFBaUIsT0FBTyxDQUFDLElBQVIsSUFBZ0IsSUFBQyxDQUFBLE9BQU8sQ0FBQyxJQUExQyxDQUFmLENBQUE7QUFBQSxNQUNBLHNDQUFNLE9BQU4sQ0FEQSxDQUpEO0tBREs7RUFBQSxDQWhDTixDQUFBOztxQkFBQTs7R0FGeUIsUUFBMUIsQ0FBQTs7QUFBQSxNQTRDTSxDQUFDLE9BQVAsR0FBaUIsV0E1Q2pCLENBQUE7Ozs7QUNBQSxJQUFBLDJDQUFBO0VBQUE7aVNBQUE7O0FBQUEsVUFBQSxHQUFhLE9BQUEsQ0FBUSxnQkFBUixDQUFiLENBQUE7O0FBQUEsV0FDQSxHQUFjLE9BQUEsQ0FBUSxlQUFSLENBRGQsQ0FBQTs7QUFBQTtBQU9DLHVDQUFBLENBQUE7O0FBQUEsK0JBQUEsTUFBQSxHQUFRLElBQVIsQ0FBQTs7QUFBQSwrQkFHQSxPQUFBLEdBQVMsSUFIVCxDQUFBOztBQVVhLEVBQUEsNEJBQUEsR0FBQTtBQUNaLElBQUEsa0RBQUEsQ0FBQSxDQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsTUFBRCxHQUFVLEVBRFYsQ0FBQTtBQUFBLElBRUEsSUFBQyxDQUFBLE9BQUQsR0FBVyxFQUZYLENBQUE7QUFBQSxJQUdBLElBQUMsQ0FBQSxFQUFELENBQUksU0FBSixFQUFlLENBQUEsU0FBQSxLQUFBLEdBQUE7YUFBQSxTQUFDLEdBQUQsR0FBQTtBQUNkLFlBQUEsc0JBQUE7QUFBQTtBQUFBLGFBQUEsMkNBQUE7NEJBQUE7QUFDQyxVQUFBLElBQXVCLE1BQU0sQ0FBQyxPQUE5QjtBQUFBLFlBQUEsTUFBTSxDQUFDLE9BQVAsQ0FBZSxHQUFmLENBQUEsQ0FBQTtXQUREO0FBQUEsU0FEYztNQUFBLEVBQUE7SUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQWYsQ0FIQSxDQUFBO0FBQUEsSUFPQSxJQUFDLENBQUEsRUFBRCxDQUFJLFNBQUosRUFBZSxDQUFBLFNBQUEsS0FBQSxHQUFBO2FBQUEsU0FBQyxHQUFELEVBQU0sT0FBTixHQUFBO0FBQ2QsWUFBQSxzQkFBQTtBQUFBO0FBQUEsYUFBQSwyQ0FBQTs0QkFBQTtBQUNDLFVBQUEsSUFBZ0MsTUFBTSxDQUFDLE9BQXZDO0FBQUEsWUFBQSxNQUFNLENBQUMsT0FBUCxDQUFlLEdBQWYsRUFBb0IsT0FBcEIsQ0FBQSxDQUFBO1dBREQ7QUFBQSxTQURjO01BQUEsRUFBQTtJQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBZixDQVBBLENBQUE7QUFBQSxJQVdBLElBQUMsQ0FBQSxFQUFELENBQUksU0FBSixFQUFlLENBQUEsU0FBQSxLQUFBLEdBQUE7YUFBQSxTQUFDLEdBQUQsR0FBQTtBQUNkLFlBQUEsc0JBQUE7QUFBQTtBQUFBLGFBQUEsMkNBQUE7NEJBQUE7QUFDQyxVQUFBLElBQXVCLE1BQU0sQ0FBQyxPQUE5QjtBQUFBLFlBQUEsTUFBTSxDQUFDLE9BQVAsQ0FBZSxHQUFmLENBQUEsQ0FBQTtXQUREO0FBQUEsU0FEYztNQUFBLEVBQUE7SUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQWYsQ0FYQSxDQUFBO0FBQUEsSUFlQSxJQUFDLENBQUEsRUFBRCxDQUFJLE9BQUosRUFBYSxDQUFBLFNBQUEsS0FBQSxHQUFBO2FBQUEsU0FBQyxHQUFELEdBQUE7QUFDWixZQUFBLHNCQUFBO0FBQUE7QUFBQSxhQUFBLDJDQUFBOzRCQUFBO0FBQ0MsVUFBQSxJQUFxQixNQUFNLENBQUMsS0FBNUI7QUFBQSxZQUFBLE1BQU0sQ0FBQyxLQUFQLENBQWEsR0FBYixDQUFBLENBQUE7V0FERDtBQUFBLFNBRFk7TUFBQSxFQUFBO0lBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFiLENBZkEsQ0FBQTtBQW1CQSxVQUFBLENBcEJZO0VBQUEsQ0FWYjs7QUFpQ0E7QUFBQTs7O0tBakNBOztBQUFBLCtCQXFDQSxNQUFBLEdBQVEsU0FBQyxNQUFELEdBQUE7QUFDUCxJQUFBLElBQUMsQ0FBQSxPQUFPLENBQUMsSUFBVCxDQUFjLE1BQWQsQ0FBQSxDQURPO0VBQUEsQ0FyQ1IsQ0FBQTs7QUEwQ0E7QUFBQTs7OztLQTFDQTs7QUFBQSwrQkErQ0EsYUFBQSxHQUFlLFNBQUMsT0FBRCxHQUFBO0FBQ2QsUUFBQSxPQUFBO0FBQUEsSUFBQSxPQUFBLEdBQWMsSUFBQSxXQUFBLENBQVksT0FBWixDQUFkLENBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxNQUFELENBQVEsT0FBUixDQURBLENBQUE7QUFFQSxXQUFPLE9BQVAsQ0FIYztFQUFBLENBL0NmLENBQUE7O0FBQUEsK0JBcURBLEdBQUEsR0FBSyxTQUFDLE9BQUQsR0FBQTtBQUNKLFFBQUEsT0FBQTtBQUFBLElBQUEsT0FBQSxHQUFVLElBQUMsQ0FBQSxhQUFELENBQWUsT0FBZixDQUFWLENBQUE7QUFBQSxJQUNBLE9BQU8sQ0FBQyxHQUFSLENBQUEsQ0FEQSxDQUFBO0FBRUEsV0FBTyxPQUFQLENBSEk7RUFBQSxDQXJETCxDQUFBOztBQUFBLCtCQTJEQSxJQUFBLEdBQU0sU0FBQyxPQUFELEdBQUE7QUFDTCxRQUFBLE9BQUE7QUFBQSxJQUFBLE9BQUEsR0FBVSxJQUFDLENBQUEsYUFBRCxDQUFlLE9BQWYsQ0FBVixDQUFBO0FBQUEsSUFDQSxPQUFPLENBQUMsSUFBUixDQUFBLENBREEsQ0FBQTtBQUVBLFdBQU8sT0FBUCxDQUhLO0VBQUEsQ0EzRE4sQ0FBQTs7QUFBQSwrQkFpRUEsSUFBQSxHQUFNLFNBQUMsR0FBRCxHQUFBO0FBQ0wsUUFBQSxhQUFBO0FBQUEsSUFBQSxJQUFBLEdBQU8sSUFBUCxDQUFBO0FBQUEsSUFDQSxPQUFBLEdBQWMsSUFBQSxPQUFBLENBQ2I7QUFBQSxNQUFBLEdBQUEsRUFBSyxHQUFMO0FBQUEsTUFDQSxLQUFBLEVBQU8sS0FEUDtBQUFBLE1BRUEsU0FBQSxFQUFXLFNBQUMsUUFBRCxHQUFBO2VBQWMsSUFBQSxHQUFPLFNBQXJCO01BQUEsQ0FGWDtBQUFBLE1BR0EsU0FBQSxFQUFXLFNBQUMsR0FBRCxHQUFBO2VBQVMsSUFBQSxHQUFPLEtBQWhCO01BQUEsQ0FIWDtLQURhLENBRGQsQ0FBQTtBQUFBLElBTUEsT0FBTyxDQUFDLElBQVIsQ0FBQSxDQU5BLENBQUE7QUFPQSxXQUFPLElBQVAsQ0FSSztFQUFBLENBakVOLENBQUE7O0FBQUEsK0JBNEVBLE1BQUEsR0FBUSxTQUFDLEdBQUQsR0FBQTtBQUNQLElBQUEsSUFBRyxDQUFBLEdBQUksQ0FBQyxPQUFSO0FBQ0MsTUFBQSxHQUFHLENBQUMsT0FBSixHQUFjLElBQWQsQ0FBQTtBQUFBLE1BQ0EsR0FBRyxDQUFDLEVBQUosQ0FBTyxTQUFQLEVBQWtCLENBQUEsU0FBQSxLQUFBLEdBQUE7ZUFBQSxTQUFBLEdBQUE7aUJBQUcsS0FBQyxDQUFBLElBQUQsQ0FBTSxTQUFOLEVBQWlCLEdBQWpCLEVBQUg7UUFBQSxFQUFBO01BQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFsQixDQURBLENBQUE7QUFBQSxNQUVBLEdBQUcsQ0FBQyxFQUFKLENBQU8sU0FBUCxFQUFrQixDQUFBLFNBQUEsS0FBQSxHQUFBO2VBQUEsU0FBQyxPQUFELEdBQUE7aUJBQWEsS0FBQyxDQUFBLElBQUQsQ0FBTSxTQUFOLEVBQWlCLEdBQWpCLEVBQXNCLE9BQXRCLEVBQWI7UUFBQSxFQUFBO01BQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFsQixDQUZBLENBQUE7QUFBQSxNQUdBLEdBQUcsQ0FBQyxFQUFKLENBQU8sU0FBUCxFQUFrQixDQUFBLFNBQUEsS0FBQSxHQUFBO2VBQUEsU0FBQSxHQUFBO2lCQUFHLEtBQUMsQ0FBQSxJQUFELENBQU0sU0FBTixFQUFpQixHQUFqQixFQUFIO1FBQUEsRUFBQTtNQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBbEIsQ0FIQSxDQUFBO0FBQUEsTUFJQSxHQUFHLENBQUMsRUFBSixDQUFPLE9BQVAsRUFBZ0IsQ0FBQSxTQUFBLEtBQUEsR0FBQTtlQUFBLFNBQUMsR0FBRCxHQUFBO2lCQUFTLEtBQUMsQ0FBQSxJQUFELENBQU0sT0FBTixFQUFlLEdBQWYsRUFBb0IsR0FBcEIsRUFBVDtRQUFBLEVBQUE7TUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQWhCLENBSkEsQ0FERDtLQURPO0VBQUEsQ0E1RVIsQ0FBQTs7NEJBQUE7O0dBSGdDLFdBSmpDLENBQUE7O0FBQUEsTUE2Rk0sQ0FBQyxPQUFQLEdBQWlCLGtCQTdGakIsQ0FBQTs7OztBQ0FBLE1BQU0sQ0FBQyxPQUFQLEdBRUM7QUFBQSxFQUFBLFdBQUEsRUFBYSxPQUFBLENBQVEsZUFBUixDQUFiO0FBQUEsRUFDQSxrQkFBQSxFQUFvQixPQUFBLENBQVEsc0JBQVIsQ0FEcEI7QUFBQSxFQUVBLGFBQUEsRUFBZSxPQUFBLENBQVEsaUJBQVIsQ0FGZjtBQUFBLEVBR0EsYUFBQSxFQUFlLE9BQUEsQ0FBUSxpQkFBUixDQUhmO0FBQUEsRUFJQSxPQUFBLEVBQVMsT0FBQSxDQUFRLFdBQVIsQ0FKVDtDQUZELENBQUE7Ozs7QUNBQSxJQUFBLDBDQUFBOztBQUFBOzhCQUVDOztBQUFBLDJCQUFBLE9BQUEsR0FBUyxTQUFDLE9BQUQsRUFBVSxPQUFWLEdBQUE7QUFDUixJQUFBLElBQUcsT0FBTyxDQUFDLElBQVIsS0FBa0IsTUFBckI7QUFDQyxZQUFBLENBREQ7S0FBQTtBQUVBLElBQUEsSUFBRyxPQUFPLENBQUMsUUFBWDtBQUNDLE1BQUEsUUFBUSxDQUFDLFFBQVQsR0FBb0IsT0FBTyxDQUFDLFFBQTVCLENBREQ7S0FIUTtFQUFBLENBQVQsQ0FBQTs7d0JBQUE7O0lBRkQsQ0FBQTs7QUFBQTs2QkFhQzs7QUFBQSwwQkFBQSxPQUFBLEdBQVMsU0FBQyxPQUFELEdBQUE7QUFDUixJQUFBLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBWCxDQUFpQixPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVosR0FBeUIsSUFBekIsR0FBZ0MsT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsT0FBekIsQ0FBaUMsY0FBakMsRUFBaUQsRUFBakQsQ0FBakQsQ0FBQSxDQURRO0VBQUEsQ0FBVCxDQUFBOzt1QkFBQTs7SUFiRCxDQUFBOztBQUFBOzJCQXFCQzs7QUFBQSx3QkFBQSxLQUFBLEdBQU8sU0FBQyxPQUFELEVBQVUsR0FBVixHQUFBO0FBQ04sSUFBQSxPQUFPLENBQUMsR0FBUixDQUFZLHVCQUFaLEVBQXFDLE9BQXJDLEVBQThDLEdBQTlDLENBQUEsQ0FETTtFQUFBLENBQVAsQ0FBQTs7cUJBQUE7O0lBckJELENBQUE7O0FBQUEsTUEyQk0sQ0FBQyxPQUFQLEdBRUM7QUFBQSxFQUFBLGNBQUEsRUFBZ0IsY0FBaEI7QUFBQSxFQUNBLGFBQUEsRUFBZSxhQURmO0FBQUEsRUFFQSxXQUFBLEVBQWEsV0FGYjtDQTdCRCxDQUFBOzs7O0FDQUEsSUFBQSxVQUFBOztBQUFBLE9BQUEsQ0FBUSxlQUFSLENBQUEsQ0FBQTs7QUFBQSxPQUNBLENBQVEsY0FBUixDQURBLENBQUE7O0FBQUEsT0FFQSxDQUFRLGdCQUFSLENBRkEsQ0FBQTs7QUFBQSxJQUtBLEdBQU8sT0FBQSxDQUFRLGtCQUFSLENBTFAsQ0FBQTs7QUFBQSxNQU1NLENBQUMsSUFBUCxHQUFjLElBTmQsQ0FBQTs7QUFBQSxJQVNBLEdBQU8sRUFUUCxDQUFBOztBQUFBLE1BVU0sQ0FBQyxJQUFQLEdBQWMsSUFWZCxDQUFBOztBQUFBLElBYUksQ0FBQyxpQkFBTCxDQUF1QixNQUF2QixFQUErQixPQUFBLENBQVEsZUFBUixDQUEvQixDQWJBLENBQUE7O0FBQUEsSUFnQkksQ0FBQyxJQUFMLEdBQVksT0FBQSxDQUFRLFFBQVIsQ0FoQlosQ0FBQTs7QUFBQSxJQWlCSSxDQUFDLE1BQUwsR0FBYyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BakJ4QixDQUFBOztBQUFBLElBa0JJLENBQUMsTUFBTCxHQUFjLElBQUksQ0FBQyxJQUFJLENBQUMsTUFsQnhCLENBQUE7O0FBQUEsSUFxQkksQ0FBQyxTQUFMLEdBQWlCLE9BQUEsQ0FBUSxhQUFSLENBckJqQixDQUFBOztBQUFBLElBc0JJLENBQUMsU0FBTCxHQUFpQixJQUFJLENBQUMsU0FBUyxDQUFDLFNBdEJoQyxDQUFBOztBQUFBLElBdUJJLENBQUMsU0FBTCxHQUFpQixJQUFJLENBQUMsU0FBUyxDQUFDLFNBdkJoQyxDQUFBOztBQUFBLElBMEJJLENBQUMsRUFBTCxHQUFVLE9BQUEsQ0FBUSxNQUFSLENBMUJWLENBQUE7O0FBQUEsSUE2QkksQ0FBQyxJQUFMLEdBQVksT0FBQSxDQUFRLFFBQVIsQ0E3QlosQ0FBQTs7QUFBQSxJQWdDSSxDQUFDLE1BQUwsR0FBYyxPQUFBLENBQVEsVUFBUixDQWhDZCxDQUFBOztBQUFBLElBbUNJLENBQUMsS0FBTCxHQUFhLE9BQUEsQ0FBUSxTQUFSLENBbkNiLENBQUE7Ozs7OztBQ0FBLElBQUEsc0JBQUE7RUFBQTtpU0FBQTs7QUFBQSxNQUFBLEdBQVMsT0FBQSxDQUFRLFVBQVIsQ0FBVCxDQUFBOztBQUFBO0FBTUMsbUNBQUEsQ0FBQTs7QUFBYSxFQUFBLHdCQUFDLE1BQUQsR0FBQTtBQUNaLElBQUEsZ0RBQU0sTUFBTixDQUFBLENBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxJQUFELEdBQVEsVUFEUixDQUFBO0FBQUEsSUFFQSxJQUFDLENBQUEsU0FBRCxHQUFhLHNCQUZiLENBQUE7QUFBQSxJQUdBLElBQUMsQ0FBQSxPQUFELEdBQVcsa0JBSFgsQ0FBQTtBQUlBLFVBQUEsQ0FMWTtFQUFBLENBQWI7O0FBQUEsMkJBUUEsa0JBQUEsR0FBb0IsU0FBQyxTQUFELEdBQUE7QUFDbkIsSUFBQSx1REFBTSxTQUFOLENBQUEsQ0FBQTtBQUFBLElBQ0EsU0FBUyxDQUFDLEVBQUUsQ0FBQyxTQUFiLENBQ0M7QUFBQSxNQUFBLEdBQUEsRUFBSyxTQUFTLENBQUMsR0FBZjtBQUFBLE1BQ0EsTUFBQSxFQUFTLFNBQVMsQ0FBQyxNQURuQjtBQUFBLE1BRUEsSUFBQSxFQUFNLFNBQVMsQ0FBQyxJQUZoQjtBQUFBLE1BR0EsS0FBQSxFQUFPLFNBQVMsQ0FBQyxLQUhqQjtLQURELENBREEsQ0FEbUI7RUFBQSxDQVJwQixDQUFBOztBQUFBLDJCQWtCQSxvQkFBQSxHQUFzQixTQUFDLFNBQUQsR0FBQTtBQUNyQixJQUFBLHlEQUFNLFNBQU4sQ0FBQSxDQUFBO0FBQUEsSUFDQSxTQUFTLENBQUMsRUFBRSxDQUFDLFNBQWIsQ0FDQztBQUFBLE1BQUEsR0FBQSxFQUFLLElBQUw7QUFBQSxNQUNBLE1BQUEsRUFBUSxJQURSO0FBQUEsTUFFQSxJQUFBLEVBQU0sSUFGTjtBQUFBLE1BR0EsS0FBQSxFQUFPLElBSFA7S0FERCxDQURBLENBRHFCO0VBQUEsQ0FsQnRCLENBQUE7O3dCQUFBOztHQUg0QixPQUg3QixDQUFBOztBQUFBLE1Ba0NNLENBQUMsT0FBUCxHQUFpQixjQWxDakIsQ0FBQTs7OztBQ0FBLElBQUEsa0JBQUE7RUFBQTtpU0FBQTs7QUFBQSxNQUFBLEdBQVMsT0FBQSxDQUFRLFVBQVIsQ0FBVCxDQUFBOztBQUFBO0FBSUMsK0JBQUEsQ0FBQTs7QUFBYSxFQUFBLG9CQUFDLE1BQUQsR0FBQTtBQUNaLElBQUEsNENBQU0sTUFBTixDQUFBLENBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxJQUFELEdBQVEsTUFEUixDQUFBO0FBQUEsSUFFQSxJQUFDLENBQUEsU0FBRCxHQUFhLEVBRmIsQ0FBQTtBQUFBLElBR0EsSUFBQyxDQUFBLE9BQUQsR0FBVyxFQUhYLENBRFk7RUFBQSxDQUFiOztvQkFBQTs7R0FGd0IsT0FGekIsQ0FBQTs7QUFBQSxNQVVNLENBQUMsT0FBUCxHQUFpQixVQVZqQixDQUFBOzs7O0FDQUEsSUFBQSxpQkFBQTtFQUFBO2lTQUFBOztBQUFBLE1BQUEsR0FBUyxPQUFBLENBQVEsVUFBUixDQUFULENBQUE7O0FBQUE7QUFJQyw4QkFBQSxDQUFBOztBQUFhLEVBQUEsbUJBQUMsTUFBRCxHQUFBO0FBQ1osSUFBQSwyQ0FBTSxNQUFOLENBQUEsQ0FBQTtBQUFBLElBQ0EsSUFBQyxDQUFBLElBQUQsR0FBUSxLQURSLENBQUE7QUFBQSxJQUVBLElBQUMsQ0FBQSxTQUFELEdBQWEsaUJBRmIsQ0FBQTtBQUFBLElBR0EsSUFBQyxDQUFBLE9BQUQsR0FBVyxrQkFIWCxDQURZO0VBQUEsQ0FBYjs7bUJBQUE7O0dBRnVCLE9BRnhCLENBQUE7O0FBQUEsTUFVTSxDQUFDLE9BQVAsR0FBaUIsU0FWakIsQ0FBQTs7OztBQ0FBLElBQUEsa0JBQUE7RUFBQTtpU0FBQTs7QUFBQSxNQUFBLEdBQVMsT0FBQSxDQUFRLFVBQVIsQ0FBVCxDQUFBOztBQUFBO0FBSUMsK0JBQUEsQ0FBQTs7QUFBYSxFQUFBLG9CQUFDLE1BQUQsR0FBQTtBQUNaLElBQUEsNENBQU0sTUFBTixDQUFBLENBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxJQUFELEdBQVEsTUFEUixDQUFBO0FBQUEsSUFFQSxJQUFDLENBQUEsU0FBRCxHQUFhLGtCQUZiLENBQUE7QUFBQSxJQUdBLElBQUMsQ0FBQSxPQUFELEdBQVcsRUFIWCxDQURZO0VBQUEsQ0FBYjs7b0JBQUE7O0dBRndCLE9BRnpCLENBQUE7O0FBQUEsTUFXTSxDQUFDLE9BQVAsR0FBaUIsVUFYakIsQ0FBQTs7OztBQ0FBLElBQUEsa0JBQUE7RUFBQTtpU0FBQTs7QUFBQSxVQUFBLEdBQWEsT0FBQSxDQUFTLGdCQUFULENBQWIsQ0FBQTs7QUFBQTtBQUlDLDJCQUFBLENBQUE7Ozs7R0FBQTs7QUFBQSxtQkFBQSxRQUFBLEdBQVUsSUFBVixDQUFBOztBQUFBLG1CQUNBLFNBQUEsR0FBVyxhQURYLENBQUE7O0FBQUEsbUJBRUEsT0FBQSxHQUFTLGtCQUZULENBQUE7O0FBQUEsbUJBR0EsU0FBQSxHQUFXLElBSFgsQ0FBQTs7QUFBQSxtQkFJQSxXQUFBLEdBQWEsS0FKYixDQUFBOztBQUFBLG1CQUtBLE9BQUEsR0FBUyxLQUxULENBQUE7O0FBQUEsbUJBTUEsV0FBQSxHQUFhLElBTmIsQ0FBQTs7QUFBQSxtQkFPQSxPQUFBLEdBQVMsSUFQVCxDQUFBOztBQUFBLG1CQVVBLFlBQUEsR0FBYyxTQUFDLFNBQUQsR0FBQTtBQUNiLElBQUEsSUFBQyxDQUFBLEtBQUQsQ0FBTyxJQUFDLENBQUEsU0FBUixFQUFtQixTQUFuQixFQUE4QixPQUE5QixFQUF1QyxJQUFDLENBQUEsS0FBRCxDQUFPLFNBQVAsQ0FBdkMsQ0FBQSxDQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsS0FBRCxDQUFPLElBQUMsQ0FBQSxTQUFSLEVBQW1CLFNBQW5CLEVBQThCLFNBQTlCLEVBQXlDLElBQUMsQ0FBQSxLQUFELENBQU8sV0FBUCxDQUF6QyxDQURBLENBQUE7QUFBQSxJQUVBLElBQUMsQ0FBQSxTQUFELEdBQWEsU0FGYixDQURhO0VBQUEsQ0FWZCxDQUFBOztBQUFBLG1CQW9CQSxtQkFBQSxHQUFxQixTQUFBLEdBQUE7QUFDcEIsV0FBTyxJQUFDLENBQUEsU0FBUyxDQUFDLGFBQVgsQ0FBQSxDQUFQLENBRG9CO0VBQUEsQ0FwQnJCLENBQUE7O0FBQUEsbUJBMEJBLGVBQUEsR0FBaUIsU0FBQSxHQUFBO0FBQ2hCLFdBQU8sSUFBQyxDQUFBLFNBQVMsQ0FBQyxZQUFYLENBQUEsQ0FBUCxDQURnQjtFQUFBLENBMUJqQixDQUFBOztBQUFBLG1CQWdDQSxVQUFBLEdBQVksU0FBQSxHQUFBO0FBQ1gsSUFBQSxJQUFDLENBQUEsV0FBRCxHQUFlLElBQWYsQ0FEVztFQUFBLENBaENaLENBQUE7O0FBQUEsbUJBdUNBLGNBQUEsR0FBZ0IsU0FBQyxNQUFELEdBQUE7QUFDZixJQUFBLElBQUMsQ0FBQSxXQUFELEdBQWUsTUFBZixDQURlO0VBQUEsQ0F2Q2hCLENBQUE7O0FBQUEsbUJBNENBLE1BQUEsR0FBUSxTQUFBLEdBQUE7QUFDUCxJQUFBLElBQTRDLElBQUMsQ0FBQSxTQUE3QztBQUFBLE1BQUEsSUFBQyxDQUFBLGVBQUQsQ0FBQSxDQUFrQixDQUFDLFFBQW5CLENBQTRCLElBQUMsQ0FBQSxTQUE3QixDQUFBLENBQUE7S0FBQTtBQUFBLElBQ0EsSUFBQyxDQUFBLE1BQUQsQ0FBQSxDQURBLENBRE87RUFBQSxDQTVDUixDQUFBOztBQUFBLG1CQWtEQSxNQUFBLEdBQVEsU0FBQSxHQUFBO0FBQ1AsSUFBQSxJQUFDLENBQUEsZ0JBQUQsQ0FBa0IsSUFBQyxDQUFBLG1CQUFELENBQUEsQ0FBbEIsRUFBMEMsSUFBQyxDQUFBLGVBQUQsQ0FBQSxDQUExQyxDQUFBLENBRE87RUFBQSxDQWxEUixDQUFBOztBQUFBLG1CQXVEQSxPQUFBLEdBQVMsU0FBQyxTQUFELEVBQVksU0FBWixFQUF1QixRQUF2QixHQUFBO0FBQ1IsSUFBQSxJQUFHLFNBQVMsQ0FBQyxRQUFiO0FBQ0MsTUFBQSxJQUFDLENBQUEsZUFBRCxDQUFpQixTQUFqQixFQUE0QixJQUFDLENBQUEsZUFBRCxDQUFBLENBQTVCLEVBQWdELFFBQWhELENBQUEsQ0FERDtLQURRO0VBQUEsQ0F2RFQsQ0FBQTs7QUFBQSxtQkE2REEsU0FBQSxHQUFXLFNBQUMsU0FBRCxFQUFZLFNBQVosR0FBQTtBQUNWLElBQUEsSUFBRyxTQUFTLENBQUMsUUFBYjtBQUNDLE1BQUEsSUFBQyxDQUFBLGVBQUQsQ0FBaUIsU0FBakIsQ0FBQSxDQUREO0tBRFU7RUFBQSxDQTdEWCxDQUFBOztBQUFBLG1CQXNFQSxnQkFBQSxHQUFrQixTQUFDLFVBQUQsRUFBYSxNQUFiLEdBQUE7QUFDakIsSUFBQSxJQUFHLENBQUEsSUFBRSxDQUFBLE9BQUw7QUFBa0IsWUFBQSxDQUFsQjtLQUFBO0FBQUEsSUFDQSxVQUFVLENBQUMsSUFBWCxDQUFnQixDQUFBLFNBQUEsS0FBQSxHQUFBO2FBQUEsU0FBQyxTQUFELEVBQVksS0FBWixHQUFBO0FBQ2YsUUFBQSxJQUFHLENBQUEsU0FBVSxDQUFDLFFBQWQ7aUJBQ0MsS0FBQyxDQUFBLGVBQUQsQ0FBaUIsU0FBakIsRUFBNEIsTUFBNUIsRUFBb0MsS0FBcEMsRUFERDtTQUFBLE1BQUE7aUJBR0MsS0FBQyxDQUFBLGVBQUQsQ0FBaUIsU0FBakIsRUFIRDtTQURlO01BQUEsRUFBQTtJQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBaEIsQ0FEQSxDQURpQjtFQUFBLENBdEVsQixDQUFBOztBQUFBLG1CQXFGQSxlQUFBLEdBQWlCLFNBQUMsU0FBRCxFQUFZLE1BQVosRUFBb0IsUUFBcEIsR0FBQTtBQUNoQixJQUFBLElBQUcsQ0FBQSxJQUFFLENBQUEsT0FBTDtBQUFrQixZQUFBLENBQWxCO0tBQUE7QUFDQSxJQUFBLElBQUcsQ0FBQSxTQUFVLENBQUMsUUFBWCxJQUF1QixDQUFBLFNBQVUsQ0FBQyxpQkFBckM7QUFDQyxNQUFBLElBQUMsQ0FBQSxrQkFBRCxDQUFvQixTQUFwQixDQUFBLENBQUE7QUFBQSxNQUNBLFNBQVMsQ0FBQyxNQUFWLENBQWlCLE1BQWpCLENBREEsQ0FBQTtBQUFBLE1BRUEsSUFBQyxDQUFBLG9CQUFELENBQXNCLFNBQXRCLENBRkEsQ0FERDtLQUZnQjtFQUFBLENBckZqQixDQUFBOztBQUFBLG1CQWlHQSxlQUFBLEdBQWlCLFNBQUMsU0FBRCxHQUFBO0FBQ2hCLElBQUEsSUFBQyxDQUFBLGtCQUFELENBQW9CLFNBQXBCLENBQUEsQ0FBQTtBQUFBLElBQ0EsU0FBUyxDQUFDLE1BQVYsQ0FBQSxDQURBLENBRGdCO0VBQUEsQ0FqR2pCLENBQUE7O0FBQUEsbUJBMEdBLGtCQUFBLEdBQW9CLFNBQUMsU0FBRCxHQUFBO0FBQ25CLElBQUEsSUFBRyxTQUFTLENBQUMsV0FBVixJQUF5QixTQUFTLENBQUMsU0FBVixDQUFBLENBQTVCO0FBQ0MsTUFBQSxTQUFTLENBQUMsU0FBVixDQUFBLENBQXFCLENBQUMsY0FBdEIsQ0FBcUMsSUFBckMsQ0FBQSxDQUREO0tBQUE7QUFHQSxJQUFBLElBQW1DLElBQUMsQ0FBQSxPQUFwQztBQUFBLE1BQUEsU0FBUyxDQUFDLEVBQUUsQ0FBQyxRQUFiLENBQXNCLElBQUMsQ0FBQSxPQUF2QixDQUFBLENBQUE7S0FIQTtBQUlBLElBQUEsSUFBbUQsU0FBUyxDQUFDLEtBQVYsSUFBbUIsU0FBUyxDQUFDLEtBQVYsS0FBbUIsSUFBekY7QUFBQSxNQUFBLFNBQVMsQ0FBQyxFQUFFLENBQUMsUUFBYixDQUFzQixPQUF0QixFQUErQixTQUFTLENBQUMsS0FBekMsQ0FBQSxDQUFBO0tBSkE7QUFLQSxJQUFBLElBQXFELFNBQVMsQ0FBQyxNQUFWLElBQW9CLFNBQVMsQ0FBQyxNQUFWLEtBQW9CLElBQTdGO0FBQUEsTUFBQSxTQUFTLENBQUMsRUFBRSxDQUFDLFFBQWIsQ0FBc0IsUUFBdEIsRUFBZ0MsU0FBUyxDQUFDLE1BQTFDLENBQUEsQ0FBQTtLQU5tQjtFQUFBLENBMUdwQixDQUFBOztBQUFBLG1CQW9IQSxvQkFBQSxHQUFzQixTQUFDLFNBQUQsR0FBQSxDQXBIdEIsQ0FBQTs7QUFBQSxtQkEySEEsZUFBQSxHQUFpQixTQUFDLFNBQUQsR0FBQTtBQUNoQixJQUFBLElBQUcsU0FBUyxDQUFDLFFBQWI7QUFDQyxNQUFBLElBQUMsQ0FBQSxvQkFBRCxDQUFzQixTQUF0QixDQUFBLENBQUE7QUFBQSxNQUNBLFNBQVMsQ0FBQyxFQUFFLENBQUMsT0FBYixDQUFBLENBREEsQ0FBQTtBQUFBLE1BRUEsSUFBQyxDQUFBLG9CQUFELENBQXNCLFNBQXRCLENBRkEsQ0FERDtLQURnQjtFQUFBLENBM0hqQixDQUFBOztBQUFBLG1CQXNJQSxvQkFBQSxHQUFzQixTQUFDLFNBQUQsR0FBQTtBQUNyQixJQUFBLElBQUcsU0FBUyxDQUFDLFdBQVYsSUFBeUIsU0FBUyxDQUFDLFNBQVYsQ0FBQSxDQUE1QjtBQUNDLE1BQUEsU0FBUyxDQUFDLFNBQVYsQ0FBQSxDQUFxQixDQUFDLGNBQXRCLENBQXFDLElBQXJDLENBQUEsQ0FERDtLQUFBO0FBR0EsSUFBQSxJQUFzQyxJQUFDLENBQUEsT0FBdkM7QUFBQSxNQUFBLFNBQVMsQ0FBQyxFQUFFLENBQUMsV0FBYixDQUF5QixJQUFDLENBQUEsT0FBMUIsQ0FBQSxDQUFBO0tBSEE7QUFJQSxJQUFBLElBQXdDLFNBQVMsQ0FBQyxLQUFsRDtBQUFBLE1BQUEsU0FBUyxDQUFDLEVBQUUsQ0FBQyxRQUFiLENBQXNCLE9BQXRCLEVBQStCLElBQS9CLENBQUEsQ0FBQTtLQUpBO0FBS0EsSUFBQSxJQUF5QyxTQUFTLENBQUMsTUFBbkQ7QUFBQSxNQUFBLFNBQVMsQ0FBQyxFQUFFLENBQUMsUUFBYixDQUFzQixRQUF0QixFQUFnQyxJQUFoQyxDQUFBLENBQUE7S0FOcUI7RUFBQSxDQXRJdEIsQ0FBQTs7QUFBQSxtQkFtSkEsb0JBQUEsR0FBc0IsU0FBQyxTQUFELEdBQUEsQ0FuSnRCLENBQUE7O0FBQUEsbUJBNkpBLFNBQUEsR0FBVyxTQUFBLEdBQUE7QUFDVixJQUFBLElBQThDLElBQUMsQ0FBQSxTQUEvQztBQUFBLE1BQUEsSUFBQyxDQUFBLGVBQUQsQ0FBQSxDQUFrQixDQUFDLFdBQW5CLENBQStCLElBQUMsQ0FBQSxTQUFoQyxDQUFBLENBQUE7S0FBQTtBQUFBLElBQ0EsSUFBQyxDQUFBLFlBQUQsQ0FBYyxJQUFkLENBREEsQ0FBQTtBQUFBLElBRUEsb0NBQUEsQ0FGQSxDQURVO0VBQUEsQ0E3SlgsQ0FBQTs7Z0JBQUE7O0dBRm9CLFdBRnJCLENBQUE7O0FBQUEsTUF3S00sQ0FBQyxPQUFQLEdBQWlCLE1BeEtqQixDQUFBOzs7O0FDQUEsTUFBTSxDQUFDLE9BQVAsR0FFQztBQUFBLEVBQUEsUUFBQSxFQUFVLE9BQUEsQ0FBUSxZQUFSLENBQVY7QUFBQSxFQUNBLElBQUEsRUFBTSxPQUFBLENBQVEsUUFBUixDQUROO0FBQUEsRUFFQSxHQUFBLEVBQUssT0FBQSxDQUFRLE9BQVIsQ0FGTDtBQUFBLEVBR0EsSUFBQSxFQUFNLE9BQUEsQ0FBUSxRQUFSLENBSE47QUFBQSxFQUlBLE1BQUEsRUFBUSxPQUFBLENBQVEsVUFBUixDQUpSO0FBQUEsRUFNQSxZQUFBLEVBQWMsU0FBQyxJQUFELEdBQUE7QUFDYixXQUFXLElBQUEsSUFBSyxDQUFBLElBQUksQ0FBQyxVQUFMLENBQUEsQ0FBQSxDQUFMLENBQUEsQ0FBWCxDQURhO0VBQUEsQ0FOZDtDQUZELENBQUE7Ozs7QUNBQSxJQUFBLFVBQUE7O0FBQUE7QUFFQyx1QkFBQSxVQUFBLEdBQVksSUFBWixDQUFBOztBQUFBLHVCQUNBLElBQUEsR0FBTSxJQUROLENBQUE7O0FBQUEsdUJBRUEsV0FBQSxHQUFhLElBRmIsQ0FBQTs7QUFLYSxFQUFBLG9CQUFBLEdBQUE7QUFDWixJQUFBLElBQUMsQ0FBQSxVQUFELEdBQWMsRUFBZCxDQUFBO0FBQ0EsVUFBQSxDQUZZO0VBQUEsQ0FMYjs7QUFBQSx1QkFVQSxVQUFBLEdBQVksU0FBRSxXQUFGLEdBQUE7QUFDWCxJQURZLElBQUMsQ0FBQSxjQUFBLFdBQ2IsQ0FEVztFQUFBLENBVlosQ0FBQTs7QUFBQSx1QkFjQSxhQUFBLEdBQWUsU0FBQyxJQUFELEVBQU8sSUFBUCxFQUFhLFVBQWIsR0FBQTtBQUNkLElBQUEsSUFBRyxDQUFBLElBQUUsQ0FBQSxXQUFMO0FBQ0MsTUFBQSxJQUFDLENBQUEsV0FBRCxHQUFlLElBQWYsQ0FBQTtBQUFBLE1BQ0EsSUFBQyxDQUFBLElBQUQsR0FBUSxJQURSLENBREQ7S0FBQTtBQUlBLElBQUEsSUFBRyxDQUFBLElBQUUsQ0FBQSxVQUFXLENBQUEsSUFBQSxDQUFoQjtBQUNDLE1BQUEsSUFBQyxDQUFBLFVBQVcsQ0FBQSxJQUFBLENBQVosR0FBb0IsRUFBcEIsQ0FERDtLQUpBO0FBT0EsSUFBQSxJQUFHLENBQUEsSUFBRSxDQUFBLFVBQVcsQ0FBQSxJQUFBLENBQU0sQ0FBQSxJQUFBLENBQXRCO0FBQ0MsTUFBQSxJQUFDLENBQUEsVUFBVyxDQUFBLElBQUEsQ0FBTSxDQUFBLElBQUEsQ0FBbEIsR0FBMEIsVUFBMUIsQ0FERDtLQUFBLE1BQUE7QUFHQyxNQUFBLE1BQU0sQ0FBQyxLQUFQLENBQWEsSUFBQyxDQUFBLFVBQVcsQ0FBQSxJQUFBLENBQU0sQ0FBQSxJQUFBLENBQS9CLEVBQXNDLFVBQXRDLENBQUEsQ0FIRDtLQVJjO0VBQUEsQ0FkZixDQUFBOztBQUFBLHVCQTZCQSxHQUFBLEdBQUssU0FBRSxJQUFGLEdBQUE7QUFDSixJQURLLElBQUMsQ0FBQSxPQUFBLElBQ04sQ0FESTtFQUFBLENBN0JMLENBQUE7O0FBQUEsdUJBaUNBLEdBQUEsR0FBSyxTQUFDLEdBQUQsR0FBQTtBQUNKLFFBQUEsVUFBQTtBQUFBLElBQUEsVUFBQSxHQUFhLElBQUMsQ0FBQSxTQUFELENBQVcsR0FBWCxFQUFnQixJQUFDLENBQUEsSUFBakIsQ0FBYixDQUFBO0FBQ0EsSUFBQSxJQUFHLFVBQUEsS0FBYyxJQUFqQjtBQUNDLE1BQUEsVUFBQSxHQUFhLElBQUMsQ0FBQSxTQUFELENBQVcsR0FBWCxFQUFnQixJQUFDLENBQUEsV0FBakIsQ0FBYixDQUREO0tBREE7QUFHQSxJQUFBLElBQUcsVUFBQSxLQUFjLElBQWpCO0FBQ0MsTUFBQSxVQUFBLEdBQWEsRUFBYixDQUREO0tBSEE7QUFLQSxXQUFPLFVBQVAsQ0FOSTtFQUFBLENBakNMLENBQUE7O0FBQUEsdUJBMENBLFNBQUEsR0FBVyxTQUFDLEdBQUQsRUFBTSxJQUFOLEdBQUE7QUFDVixRQUFBLDJCQUFBO0FBQUEsSUFBQSxLQUFBLEdBQVEsSUFBQyxDQUFBLFVBQVcsQ0FBQSxJQUFBLENBQXBCLENBQUE7QUFDQSxJQUFBLElBQUcsQ0FBQSxLQUFIO0FBQ0MsYUFBTyxJQUFQLENBREQ7S0FEQTtBQUdBO0FBQUEsU0FBQSwyQ0FBQTtzQkFBQTtBQUNDLE1BQUEsS0FBQSxHQUFRLEtBQU0sQ0FBQSxJQUFBLENBQWQsQ0FBQTtBQUNBLE1BQUEsSUFBRyxLQUFBLEtBQVMsTUFBWjtBQUEyQixlQUFPLElBQVAsQ0FBM0I7T0FEQTtBQUVBLE1BQUEsSUFBRyxDQUFBLEtBQUg7QUFBZSxjQUFmO09BSEQ7QUFBQSxLQUhBO0FBT0EsV0FBTyxLQUFQLENBUlU7RUFBQSxDQTFDWCxDQUFBOztvQkFBQTs7SUFGRCxDQUFBOztBQUFBLE1BdURNLENBQUMsT0FBUCxHQUFpQixVQXZEakIsQ0FBQTs7OztBQ0FBLE1BQU0sQ0FBQyxPQUFQLEdBRUM7QUFBQSxFQUFBLFVBQUEsRUFBWSxPQUFBLENBQVEsY0FBUixDQUFaO0NBRkQsQ0FBQTs7OztBQ0FBLElBQUEsVUFBQTs7QUFBQTtBQUVjLEVBQUEsb0JBQUMsTUFBRCxHQUFBO0FBQ1osUUFBQSxHQUFBOztNQURhLFNBQVM7S0FDdEI7QUFBQSxJQUFBLElBQUMsQ0FBQSxLQUFELEdBQVMsRUFBVCxDQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsTUFBRCxHQUFVLENBRFYsQ0FBQTtBQUVBLElBQUEsSUFBRyxNQUFIO0FBQ0MsTUFBQSxJQUFHLE1BQUEsWUFBa0IsVUFBckI7QUFDQyxhQUFBLG1CQUFBLEdBQUE7QUFDQyxVQUFBLElBQUMsQ0FBQSxLQUFNLENBQUEsR0FBQSxDQUFQLEdBQWMsTUFBTSxDQUFDLEtBQU0sQ0FBQSxHQUFBLENBQTNCLENBREQ7QUFBQSxTQUREO09BQUEsTUFBQTtBQUlDLGFBQUEsYUFBQSxHQUFBO0FBQ0MsVUFBQSxJQUFDLENBQUEsS0FBTSxDQUFBLEdBQUEsQ0FBUCxHQUFjLE1BQU8sQ0FBQSxHQUFBLENBQXJCLENBREQ7QUFBQSxTQUpEO09BREQ7S0FIWTtFQUFBLENBQWI7O0FBQUEsdUJBWUEsSUFBQSxHQUFNLFNBQUMsRUFBRCxHQUFBO0FBQ0wsSUFBQSxNQUFNLENBQUMsSUFBUCxDQUFZLElBQUMsQ0FBQSxLQUFiLEVBQW9CLEVBQXBCLENBQUEsQ0FESztFQUFBLENBWk4sQ0FBQTs7QUFBQSx1QkFpQkEsTUFBQSxHQUFRLFNBQUMsRUFBRCxHQUFBO0FBQ1AsV0FBTyxNQUFNLENBQUMsTUFBUCxDQUFjLElBQUMsQ0FBQSxLQUFmLEVBQXNCLEVBQXRCLENBQVAsQ0FETztFQUFBLENBakJSLENBQUE7O0FBQUEsdUJBcUJBLElBQUEsR0FBTSxTQUFDLEVBQUQsR0FBQTtBQUNMLFdBQU8sTUFBTSxDQUFDLElBQVAsQ0FBWSxJQUFDLENBQUEsS0FBYixFQUFvQixFQUFwQixDQUFQLENBREs7RUFBQSxDQXJCTixDQUFBOztBQUFBLHVCQXlCQSxHQUFBLEdBQUssU0FBQyxJQUFELEVBQU8sS0FBUCxHQUFBO0FBQ0osSUFBQSxJQUFHLENBQUEsSUFBRSxDQUFBLEdBQUQsQ0FBSyxJQUFMLENBQUo7QUFBb0IsTUFBQSxJQUFDLENBQUEsTUFBRCxFQUFBLENBQXBCO0tBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxLQUFNLENBQUEsSUFBQSxDQUFQLEdBQWUsS0FEZixDQURJO0VBQUEsQ0F6QkwsQ0FBQTs7QUFBQSx1QkErQkEsR0FBQSxHQUFLLFNBQUMsSUFBRCxFQUFPLEdBQVAsR0FBQTs7TUFBTyxNQUFNO0tBQ2pCO0FBQU8sSUFBQSxJQUFHLElBQUMsQ0FBQSxHQUFELENBQUssSUFBTCxDQUFIO2FBQW1CLElBQUMsQ0FBQSxLQUFNLENBQUEsSUFBQSxFQUExQjtLQUFBLE1BQUE7YUFBcUMsSUFBckM7S0FESDtFQUFBLENBL0JMLENBQUE7O0FBQUEsdUJBbUNBLEtBQUEsR0FBTyxTQUFDLElBQUQsRUFBTyxLQUFQLEdBQUE7QUFDTixRQUFBLG9CQUFBO0FBQUE7QUFBQSxTQUFBLDJDQUFBO3NCQUFBO0FBQ0MsTUFBQSxJQUFHLElBQUssQ0FBQSxJQUFBLENBQUwsS0FBYyxLQUFqQjtBQUNDLGVBQU8sSUFBUCxDQUREO09BREQ7QUFBQSxLQUFBO0FBR0EsV0FBTyxJQUFQLENBSk07RUFBQSxDQW5DUCxDQUFBOztBQUFBLHVCQTBDQSxHQUFBLEdBQUssU0FBQyxJQUFELEdBQUE7QUFDSixXQUFPLElBQUMsQ0FBQSxLQUFNLENBQUEsSUFBQSxDQUFQLEtBQWtCLE1BQXpCLENBREk7RUFBQSxDQTFDTCxDQUFBOztBQUFBLHVCQThDQSxNQUFBLEdBQVEsU0FBQyxJQUFELEdBQUE7QUFDUCxJQUFBLElBQUcsSUFBQyxDQUFBLEtBQU0sQ0FBQSxJQUFBLENBQVY7QUFDQyxNQUFBLE1BQUEsQ0FBQSxJQUFRLENBQUEsS0FBTSxDQUFBLElBQUEsQ0FBZCxDQUFBO0FBQUEsTUFDQSxJQUFDLENBQUEsTUFBRCxFQURBLENBREQ7S0FETztFQUFBLENBOUNSLENBQUE7O0FBQUEsdUJBcURBLEtBQUEsR0FBTyxTQUFBLEdBQUE7QUFDTixJQUFBLElBQUMsQ0FBQSxLQUFELEdBQVMsRUFBVCxDQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsTUFBRCxHQUFVLENBRFYsQ0FETTtFQUFBLENBckRQLENBQUE7O0FBQUEsdUJBMkRBLFFBQUEsR0FBVSxTQUFBLEdBQUE7QUFDVCxRQUFBLGVBQUE7QUFBQTtBQUFBLFNBQUEsV0FBQTt1QkFBQTtBQUNDLGFBQU8sSUFBUCxDQUREO0FBQUEsS0FBQTtBQUVBLFdBQU8sSUFBUCxDQUhTO0VBQUEsQ0EzRFYsQ0FBQTs7QUFBQSx1QkFpRUEsT0FBQSxHQUFTLFNBQUEsR0FBQTtBQUNSLFFBQUEscUJBQUE7QUFBQSxJQUFBLElBQUEsR0FBTyxJQUFQLENBQUE7QUFDQTtBQUFBLFNBQUEsV0FBQTt1QkFBQTtBQUNDLE1BQUEsSUFBQSxHQUFPLElBQVAsQ0FBQTtBQUNBLGVBRkQ7QUFBQSxLQURBO0FBSUEsV0FBTyxJQUFQLENBTFE7RUFBQSxDQWpFVCxDQUFBOztBQUFBLHVCQXlFQSxLQUFBLEdBQU8sU0FBQyxLQUFELEdBQUE7QUFDTixXQUFPLE1BQU0sQ0FBQyxLQUFQLENBQWEsSUFBQyxDQUFBLEtBQWQsRUFBcUIsS0FBckIsQ0FBUCxDQURNO0VBQUEsQ0F6RVAsQ0FBQTs7QUFBQSx1QkE2RUEsT0FBQSxHQUFTLFNBQUMsSUFBRCxHQUFBO0FBQ1IsUUFBQSxzQkFBQTtBQUFBLElBQUEsS0FBQSxHQUFRLENBQVIsQ0FBQTtBQUNBO0FBQUEsU0FBQSxXQUFBO3VCQUFBO0FBQ0MsTUFBQSxJQUFHLElBQUEsS0FBUSxJQUFYO0FBQXFCLGVBQU8sS0FBUCxDQUFyQjtPQUFBO0FBQUEsTUFDQSxLQUFBLEVBREEsQ0FERDtBQUFBLEtBREE7QUFJQSxXQUFPLENBQUEsQ0FBUCxDQUxRO0VBQUEsQ0E3RVQsQ0FBQTs7QUFBQSx1QkFxRkEsS0FBQSxHQUFPLFNBQUMsRUFBRCxHQUFBO0FBQ04sUUFBQSxzQkFBQTtBQUFBLElBQUEsS0FBQSxHQUFRLENBQVIsQ0FBQTtBQUNBO0FBQUEsU0FBQSxXQUFBO3VCQUFBO0FBQ0MsTUFBQSxJQUFHLEtBQUEsS0FBUyxFQUFaO0FBQW9CLGVBQU8sSUFBUCxDQUFwQjtPQUFBO0FBQUEsTUFDQSxLQUFBLEVBREEsQ0FERDtBQUFBLEtBREE7QUFJQSxXQUFPLElBQVAsQ0FMTTtFQUFBLENBckZQLENBQUE7O0FBQUEsdUJBNkZBLE9BQUEsR0FBUyxTQUFBLEdBQUE7QUFDUixXQUFPLE1BQU0sQ0FBQyxJQUFQLENBQVksSUFBQyxDQUFBLEtBQWIsQ0FBUCxDQURRO0VBQUEsQ0E3RlQsQ0FBQTs7QUFBQSx1QkFpR0EsU0FBQSxHQUFXLFNBQUEsR0FBQTtBQUNWLFdBQU8sTUFBTSxDQUFDLE1BQVAsQ0FBYyxJQUFDLENBQUEsS0FBZixDQUFQLENBRFU7RUFBQSxDQWpHWCxDQUFBOztBQUFBLHVCQXFHQSxPQUFBLEdBQVMsU0FBQSxHQUFBO0FBQ1IsUUFBQSxzQkFBQTtBQUFBLElBQUEsS0FBQSxHQUFRLEVBQVIsQ0FBQTtBQUNBO0FBQUEsU0FBQSxXQUFBO3VCQUFBO0FBQ0MsTUFBQSxLQUFLLENBQUMsSUFBTixDQUFXLElBQVgsQ0FBQSxDQUREO0FBQUEsS0FEQTtBQUdBLFdBQU8sS0FBUCxDQUpRO0VBQUEsQ0FyR1QsQ0FBQTs7QUFBQSx1QkE0R0EsT0FBQSxHQUFTLFNBQUEsR0FBQTtBQUNSLFFBQUEsZUFBQTtBQUFBO0FBQUEsU0FBQSxXQUFBO3VCQUFBO0FBQ0MsTUFBQSxJQUFHLElBQUksQ0FBQyxPQUFSO0FBQXFCLFFBQUEsSUFBSSxDQUFDLE9BQUwsQ0FBQSxDQUFBLENBQXJCO09BQUE7QUFBQSxNQUNBLE1BQUEsQ0FBQSxJQUFRLENBQUEsS0FBTSxDQUFBLEdBQUEsQ0FEZCxDQUREO0FBQUEsS0FEUTtFQUFBLENBNUdULENBQUE7O29CQUFBOztJQUZELENBQUE7O0FBQUEsTUFxSE0sQ0FBQyxPQUFQLEdBQWlCLFVBckhqQixDQUFBOzs7O0FDQUEsSUFBQSxvQ0FBQTs7QUFBQTtrQ0FHQzs7QUFBQSwrQkFBQSxJQUFBLEdBQU0sU0FBQyxPQUFELEVBQVUsSUFBVixHQUFBO0FBQ0wsSUFBQSxJQUFHLENBQUEsT0FBSDtBQUNDLFlBQUEsQ0FERDtLQUFBO0FBRUEsSUFBQSxJQUFHLElBQUEsS0FBUSxPQUFYO0FBQ0MsTUFBQSxPQUFPLENBQUMsS0FBUixDQUFjLE9BQWQsQ0FBQSxDQUREO0tBQUEsTUFBQTtBQUdDLE1BQUEsT0FBTyxDQUFDLEdBQVIsQ0FBWSxRQUFaLEVBQXNCLE9BQXRCLEVBQStCLElBQS9CLENBQUEsQ0FIRDtLQUhLO0VBQUEsQ0FBTixDQUFBOzs0QkFBQTs7SUFIRCxDQUFBOztBQUFBO0FBZ0JDLDZCQUFBLFFBQUEsR0FBVSxJQUFWLENBQUE7O0FBR2EsRUFBQSwwQkFBQSxHQUFBO0FBQ1osSUFBQSxJQUFDLENBQUEsUUFBRCxHQUFnQixJQUFBLGtCQUFBLENBQUEsQ0FBaEIsQ0FBQTtBQUNBLFVBQUEsQ0FGWTtFQUFBLENBSGI7O0FBQUEsNkJBUUEsT0FBQSxHQUFTLFNBQUMsT0FBRCxHQUFBO0FBQ1IsSUFBQSxJQUFDLENBQUEsT0FBRCxDQUFTLE9BQVQsRUFBa0IsU0FBbEIsQ0FBQSxDQURRO0VBQUEsQ0FSVCxDQUFBOztBQUFBLDZCQWFBLEtBQUEsR0FBTyxTQUFDLE9BQUQsR0FBQTtBQUNOLElBQUEsSUFBQyxDQUFBLE9BQUQsQ0FBUyxPQUFULEVBQWtCLE9BQWxCLENBQUEsQ0FETTtFQUFBLENBYlAsQ0FBQTs7QUFBQSw2QkFrQkEsSUFBQSxHQUFNLFNBQUMsT0FBRCxHQUFBO0FBQ0wsSUFBQSxJQUFDLENBQUEsT0FBRCxDQUFTLE9BQVQsRUFBa0IsTUFBbEIsQ0FBQSxDQURLO0VBQUEsQ0FsQk4sQ0FBQTs7QUFBQSw2QkF1QkEsT0FBQSxHQUFTLFNBQUMsT0FBRCxHQUFBO0FBQ1IsSUFBQSxJQUFDLENBQUEsT0FBRCxDQUFTLE9BQVQsRUFBa0IsU0FBbEIsQ0FBQSxDQURRO0VBQUEsQ0F2QlQsQ0FBQTs7QUFBQSw2QkE0QkEsT0FBQSxHQUFTLFNBQUMsT0FBRCxFQUFVLElBQVYsR0FBQTtBQUNSLElBQUEsSUFBa0MsSUFBQyxDQUFBLFFBQW5DO0FBQUEsTUFBQSxJQUFDLENBQUEsUUFBUSxDQUFDLElBQVYsQ0FBZSxPQUFmLEVBQXdCLElBQXhCLENBQUEsQ0FBQTtLQURRO0VBQUEsQ0E1QlQsQ0FBQTs7MEJBQUE7O0lBaEJELENBQUE7O0FBQUEsTUFpRE0sQ0FBQyxPQUFQLEdBQWlCLGdCQWpEakIsQ0FBQTs7OztBQ0FBLElBQUEsV0FBQTs7QUFBQTtBQUVDLHdCQUFBLE1BQUEsR0FBUSxJQUFSLENBQUE7O0FBQUEsd0JBQ0EsS0FBQSxHQUFPLE9BRFAsQ0FBQTs7QUFBQSx3QkFFQSxRQUFBLEdBQVUsSUFGVixDQUFBOztBQUFBLHdCQUdBLFdBQUEsR0FBYSxJQUhiLENBQUE7O0FBQUEsd0JBSUEsTUFBQSxHQUFRLElBSlIsQ0FBQTs7QUFPYSxFQUFBLHFCQUFDLE1BQUQsRUFBUyxLQUFULEdBQUE7QUFDWixJQUFBLElBQUMsQ0FBQSxNQUFELEdBQVUsTUFBVixDQUFBO0FBQ0EsSUFBQSxJQUFrQixLQUFsQjtBQUFBLE1BQUEsSUFBQyxDQUFBLEtBQUQsR0FBUyxLQUFULENBQUE7S0FEQTtBQUFBLElBRUEsSUFBQyxDQUFBLFFBQUQsR0FBWSxFQUZaLENBQUE7QUFBQSxJQUdBLElBQUMsQ0FBQSxXQUFELEdBQWUsQ0FBQSxTQUFBLEtBQUEsR0FBQTthQUFBLFNBQUMsQ0FBRCxHQUFBO0FBQ2QsWUFBQSxTQUFBO0FBQUEsUUFBQSxJQUFHLEtBQUMsQ0FBQSxRQUFTLENBQUEsQ0FBQyxDQUFDLEdBQUYsQ0FBYjtBQUNDLFVBQUEsU0FBQSxHQUFZLEtBQUMsQ0FBQSxRQUFTLENBQUEsQ0FBQyxDQUFDLEdBQUYsQ0FBVixDQUFpQixDQUFqQixDQUFaLENBQUE7QUFDQSxVQUFBLElBQUcsU0FBSDtBQUFrQixZQUFBLENBQUMsQ0FBQyxJQUFGLENBQUEsQ0FBQSxDQUFsQjtXQUZEO1NBRGM7TUFBQSxFQUFBO0lBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUhmLENBQUE7QUFBQSxJQVFBLElBQUMsQ0FBQSxNQUFELENBQUEsQ0FSQSxDQUFBO0FBU0EsVUFBQSxDQVZZO0VBQUEsQ0FQYjs7QUFBQSx3QkFvQkEsRUFBQSxHQUFJLFNBQUMsSUFBRCxFQUFPLE9BQVAsR0FBQTtBQUNILElBQUEsSUFBQyxDQUFBLFFBQVMsQ0FBQSxJQUFBLENBQVYsR0FBa0IsT0FBbEIsQ0FERztFQUFBLENBcEJKLENBQUE7O0FBQUEsd0JBeUJBLE1BQUEsR0FBUSxTQUFBLEdBQUE7QUFDUCxJQUFBLElBQUcsQ0FBQSxJQUFFLENBQUEsTUFBTDtBQUFpQixZQUFBLENBQWpCO0tBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxNQUFELEdBQVUsS0FEVixDQUFBO0FBQUEsSUFFQSxJQUFDLENBQUEsTUFBTSxDQUFDLEVBQVIsQ0FBVyxJQUFDLENBQUEsS0FBWixFQUFtQixJQUFDLENBQUEsV0FBcEIsQ0FGQSxDQURPO0VBQUEsQ0F6QlIsQ0FBQTs7QUFBQSx3QkFnQ0EsS0FBQSxHQUFPLFNBQUEsR0FBQTtBQUNOLElBQUEsSUFBRyxJQUFDLENBQUEsTUFBSjtBQUFnQixZQUFBLENBQWhCO0tBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxNQUFELEdBQVUsSUFEVixDQUFBO0FBQUEsSUFFQSxJQUFDLENBQUEsTUFBTSxDQUFDLEVBQVIsQ0FBVyxJQUFDLENBQUEsS0FBWixFQUFtQixJQUFDLENBQUEsV0FBcEIsQ0FGQSxDQURNO0VBQUEsQ0FoQ1AsQ0FBQTs7QUFBQSx3QkF1Q0EsT0FBQSxHQUFTLFNBQUEsR0FBQTtBQUNSLElBQUEsSUFBQyxDQUFBLEtBQUQsQ0FBQSxDQUFBLENBRFE7RUFBQSxDQXZDVCxDQUFBOztxQkFBQTs7SUFGRCxDQUFBOztBQUFBLE1BOENNLENBQUMsT0FBUCxHQUFpQixXQTlDakIsQ0FBQTs7OztBQ0FBLElBQUEsbUJBQUE7RUFBQTtpU0FBQTs7QUFBQSxVQUFBLEdBQWEsT0FBQSxDQUFRLGdCQUFSLENBQWIsQ0FBQTs7QUFBQTtBQVdDLDRCQUFBLENBQUE7O0FBQUEsb0JBQUEsS0FBQSxHQUFPLE1BQVAsQ0FBQTs7QUFBQSxvQkFDQSxPQUFBLEdBQVMsR0FEVCxDQUFBOztBQUFBLG9CQUVBLE1BQUEsR0FBUSxJQUZSLENBQUE7O0FBQUEsb0JBR0EsTUFBQSxHQUFRLElBSFIsQ0FBQTs7QUFBQSxvQkFJQSxPQUFBLEdBQVMsSUFKVCxDQUFBOztBQU9hLEVBQUEsaUJBQUUsTUFBRixFQUFVLE1BQVYsR0FBQTtBQUNaLElBRGEsSUFBQyxDQUFBLFNBQUEsTUFDZCxDQUFBO0FBQUEsSUFBQSx5Q0FBTSxNQUFOLENBQUEsQ0FBQTtBQUFBLElBRUEsSUFBQyxDQUFBLE9BQUQsR0FBZSxJQUFBLE9BQUEsQ0FBUSxLQUFSLEVBQ2Q7QUFBQSxNQUFBLE1BQUEsRUFBUSxJQUFDLENBQUEsTUFBVDtBQUFBLE1BQ0EsR0FBQSxFQUFLLGNBREw7QUFBQSxNQUVBLE1BQUEsRUFDQztBQUFBLFFBQUEsUUFBQSxFQUFVLFVBQVY7QUFBQSxRQUNBLFVBQUEsRUFBWSxJQUFDLENBQUEsS0FEYjtBQUFBLFFBRUEsU0FBQSxFQUFXLElBQUMsQ0FBQSxNQUZaO09BSEQ7S0FEYyxDQUZmLENBQUE7QUFBQSxJQVVBLElBQUMsQ0FBQSxPQUFPLENBQUMsRUFBVCxDQUFZLE9BQVosRUFBcUIsQ0FBQSxTQUFBLEtBQUEsR0FBQTthQUFBLFNBQUEsR0FBQTtlQUFJLEtBQUMsQ0FBQSxJQUFELENBQU0sT0FBTixFQUFKO01BQUEsRUFBQTtJQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBckIsQ0FWQSxDQUFBO0FBV0EsVUFBQSxDQVpZO0VBQUEsQ0FQYjs7QUFBQSxvQkFzQkEsU0FBQSxHQUFXLFNBQUMsTUFBRCxHQUFBO0FBQ1YsSUFBQSxJQUFDLENBQUEsT0FBTyxDQUFDLFFBQVQsQ0FBa0IsU0FBbEIsRUFBNkIsTUFBN0IsQ0FBQSxDQURVO0VBQUEsQ0F0QlgsQ0FBQTs7QUFBQSxvQkEyQkEsSUFBQSxHQUFNLFNBQUEsR0FBQTtBQUNMLElBQUEsSUFBQyxDQUFBLE1BQUQsR0FBVSxJQUFWLENBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxJQUFELENBQU0sTUFBTixDQURBLENBQUE7QUFBQSxJQUVBLElBQUMsQ0FBQSxNQUFNLENBQUMsUUFBUixDQUFpQixnQkFBakIsQ0FGQSxDQUFBO0FBQUEsSUFHQSxJQUFDLENBQUEsT0FBTyxDQUFDLFFBQVQsQ0FBa0IsU0FBbEIsRUFBNkIsT0FBN0IsQ0FIQSxDQUFBO0FBQUEsSUFJQSxDQUFDLENBQUEsU0FBQSxLQUFBLEdBQUE7YUFBQSxTQUFBLEdBQUE7ZUFBSSxLQUFDLENBQUEsT0FBTyxDQUFDLFFBQVQsQ0FBa0IsU0FBbEIsRUFBNkIsS0FBQyxDQUFBLE9BQTlCLEVBQUo7TUFBQSxFQUFBO0lBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFELENBQTRDLENBQUMsS0FBN0MsQ0FBbUQsQ0FBbkQsQ0FKQSxDQUFBO0FBQUEsSUFLQSxJQUFDLENBQUEsSUFBRCxDQUFNLE1BQU4sQ0FMQSxDQURLO0VBQUEsQ0EzQk4sQ0FBQTs7QUFBQSxvQkFxQ0EsS0FBQSxHQUFPLFNBQUEsR0FBQTtBQUNOLElBQUEsSUFBQyxDQUFBLE1BQUQsR0FBVSxLQUFWLENBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxJQUFELENBQU0sT0FBTixDQURBLENBQUE7QUFBQSxJQUVBLElBQUMsQ0FBQSxNQUFNLENBQUMsV0FBUixDQUFvQixnQkFBcEIsQ0FGQSxDQUFBO0FBQUEsSUFHQSxJQUFDLENBQUEsT0FBTyxDQUFDLFFBQVQsQ0FBa0IsU0FBbEIsRUFBNkIsR0FBN0IsQ0FIQSxDQUFBO0FBQUEsSUFJQSxDQUFDLENBQUEsU0FBQSxLQUFBLEdBQUE7YUFBQSxTQUFBLEdBQUE7QUFBSSxRQUFBLElBQXdDLENBQUEsS0FBRSxDQUFBLE1BQTFDO2lCQUFBLEtBQUMsQ0FBQSxPQUFPLENBQUMsUUFBVCxDQUFrQixTQUFsQixFQUE2QixNQUE3QixFQUFBO1NBQUo7TUFBQSxFQUFBO0lBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFELENBQXVELENBQUMsS0FBeEQsQ0FBOEQsR0FBOUQsQ0FKQSxDQUFBO0FBQUEsSUFLQSxJQUFDLENBQUEsSUFBRCxDQUFNLE1BQU4sQ0FMQSxDQURNO0VBQUEsQ0FyQ1AsQ0FBQTs7QUFBQSxvQkErQ0EsU0FBQSxHQUFXLFNBQUEsR0FBQTtBQUNWLElBQUEsSUFBQyxDQUFBLE9BQU8sQ0FBQyxPQUFULENBQUEsQ0FBQSxDQUFBO1dBQ0Esd0NBQUEsU0FBQSxFQUZVO0VBQUEsQ0EvQ1gsQ0FBQTs7aUJBQUE7O0dBUnFCLFdBSHRCLENBQUE7O0FBQUEsTUErRE0sQ0FBQyxPQUFQLEdBQWlCLE9BL0RqQixDQUFBOzs7O0FDQUEsTUFBTSxDQUFDLE9BQVAsR0FFQztBQUFBLEVBQUEsT0FBQSxFQUFTLE9BQUEsQ0FBUSxXQUFSLENBQVQ7QUFBQSxFQUNBLFVBQUEsRUFBWSxPQUFBLENBQVEsY0FBUixDQURaO0FBQUEsRUFFQSxXQUFBLEVBQWEsT0FBQSxDQUFRLGVBQVIsQ0FGYjtBQUFBLEVBR0EsZ0JBQUEsRUFBa0IsT0FBQSxDQUFRLG9CQUFSLENBSGxCO0NBRkQsQ0FBQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCJkaSA9IHJlcXVpcmUgJy4vZGknXG5odHRwID0gcmVxdWlyZSAnLi9odHRwJ1xuY29tcG9uZW50ID0gcmVxdWlyZSAnLi9jb21wb25lbnQnXG51dGlscyA9IHJlcXVpcmUgJy4vdXRpbHMnXG5cblxuY2xhc3MgTWl3b0V4dGVuc2lvbiBleHRlbmRzIGRpLkluamVjdG9yRXh0ZW5zaW9uXG5cblxuXHRpbml0OiAtPlxuXHRcdEBzZXRDb25maWdcblx0XHRcdGh0dHA6XG5cdFx0XHRcdHBhcmFtczoge31cblx0XHRcdFx0cGx1Z2luczpcblx0XHRcdFx0XHRyZWRpcmVjdDogaHR0cC5wbHVnaW5zLlJlZGlyZWN0UGx1Z2luXG5cdFx0XHRcdFx0ZmFpbHVyZTogaHR0cC5wbHVnaW5zLkZhaWx1cmVQbHVnaW5cblx0XHRcdFx0XHRlcnJvcjogaHR0cC5wbHVnaW5zLkVycm9yUGx1Z2luXG5cdFx0XHRjb29raWU6XG5cdFx0XHRcdGRvY3VtZW50OiBudWxsXG5cdFx0XHRkaTpcblx0XHRcdFx0c2VydmljZXM6IHt9XG5cdFx0XHRmbGFzaDpcblx0XHRcdFx0cmVuZGVyZXI6IG51bGxcblx0XHRyZXR1cm5cblxuXG5cdGJ1aWxkOiAoaW5qZWN0b3IpIC0+XG5cdFx0Y29uZmlnID0gQGNvbmZpZ1xuXHRcdG5hbWVzcGFjZSA9IHdpbmRvd1tpbmplY3Rvci5wYXJhbXMubmFtZXNwYWNlXVxuXHRcdGlmICFuYW1lc3BhY2Vcblx0XHRcdG5hbWVzcGFjZSA9IHt9XG5cdFx0XHR3aW5kb3dbaW5qZWN0b3IucGFyYW1zLm5hbWVzcGFjZV0gPSBuYW1lc3BhY2VcblxuXHRcdGlmICFuYW1lc3BhY2UuY29tcG9uZW50cyB0aGVuIG5hbWVzcGFjZS5jb21wb25lbnRzID0ge31cblx0XHRpZiAhbmFtZXNwYWNlLmNvbnRyb2xsZXJzIHRoZW4gbmFtZXNwYWNlLmNvbnRyb2xsZXJzID0ge31cblxuXG5cdFx0IyBzZXR1cCBkaVxuXHRcdGZvciBuYW1lLHNlcnZpY2Ugb2YgY29uZmlnLmRpLnNlcnZpY2VzXG5cdFx0XHRpbmplY3Rvci5zZXRHbG9iYWwobmFtZSxzZXJ2aWNlKVxuXG5cblx0XHQjIHNldHVwIGh0dHBcblx0XHRpbmplY3Rvci5kZWZpbmUgJ2h0dHAnLCBodHRwLkh0dHBSZXF1ZXN0TWFuYWdlciwgKHNlcnZpY2UpIC0+XG5cdFx0XHRzZXJ2aWNlLnBhcmFtcyA9IGNvbmZpZy5odHRwLnBhcmFtc1xuXHRcdFx0Zm9yIG5hbWUscGx1Z2luIG9mIGNvbmZpZy5odHRwLnBsdWdpbnNcblx0XHRcdFx0c2VydmljZS5wbHVnaW4obmV3IHBsdWdpbigpKSBpZiBwbHVnaW5cblx0XHRcdHJldHVyblxuXG5cdFx0aW5qZWN0b3IuZGVmaW5lICdjb29raWUnLCBodHRwLkNvb2tpZU1hbmFnZXIsIChzZXJ2aWNlKSAtPlxuXHRcdFx0aWYgY29uZmlnLmNvb2tpZS5kb2N1bWVudFxuXHRcdFx0XHRzZXJ2aWNlLmRvY3VtZW50ID0gY29uZmlnLmNvb2tpZS5kb2N1bWVudFxuXHRcdFx0cmV0dXJuXG5cblxuXHRcdCMgc2V0dXAgY29tcG9uZW50c1xuXHRcdGluamVjdG9yLmRlZmluZSAnY29tcG9uZW50TWdyJywgY29tcG9uZW50LkNvbXBvbmVudE1hbmFnZXJcblxuXHRcdGluamVjdG9yLmRlZmluZSAnY29tcG9uZW50U3RhdGVNZ3InLCBjb21wb25lbnQuU3RhdGVNYW5hZ2VyXG5cblx0XHRpbmplY3Rvci5kZWZpbmUgJ2NvbXBvbmVudFN0YXRlUGVyc2lzdGVyJywgY29tcG9uZW50LlN0YXRlUGVyc2lzdGVyXG5cblx0XHRpbmplY3Rvci5kZWZpbmUgJ2NvbXBvbmVudFNlbGVjdG9yJywgY29tcG9uZW50LkNvbXBvbmVudFNlbGVjdG9yXG5cblx0XHRpbmplY3Rvci5kZWZpbmUgJ3pJbmRleE1ncicsIGNvbXBvbmVudC5aSW5kZXhNYW5hZ2VyXG5cblxuXHRcdCMgc2V0dXAgdXRpbHNcblx0XHRpbmplY3Rvci5kZWZpbmUgJ2ZsYXNoJywgdXRpbHMuRmxhc2hOb3RpZmljYXRvciwgKHNlcnZpY2UpIC0+XG5cdFx0XHRpZiBjb25maWcuZmxhc2gucmVuZGVyZXJcblx0XHRcdFx0c2VydmljZS5yZW5kZXJlciA9IGNvbmZpZy5mbGFzaC5yZW5kZXJlclxuXHRcdFx0cmV0dXJuXG5cdFx0cmV0dXJuXG5cblxuXG5tb2R1bGUuZXhwb3J0cyA9IE1pd29FeHRlbnNpb24iLCJJbmplY3RvckZhY3RvcnkgPSByZXF1aXJlICcuLi9kaS9JbmplY3RvckZhY3RvcnknXG5cblxuY2xhc3MgQ29uZmlndXJhdG9yXG5cblx0bWl3bzogbnVsbFxuXHRpbmplY3RvckZhY3Rvcnk6IG51bGxcblxuXG5cdGNvbnN0cnVjdG9yOiAoQG1pd28pIC0+XG5cdFx0QGluamVjdG9yRmFjdG9yeSA9IG5ldyBJbmplY3RvckZhY3RvcnkoKVxuXG5cblx0Y3JlYXRlSW5qZWN0b3I6ICgpIC0+XG5cdFx0aW5qZWN0b3IgPSBAaW5qZWN0b3JGYWN0b3J5LmNyZWF0ZUluamVjdG9yKClcblx0XHRAbWl3by5zZXRJbmplY3RvcihpbmplY3Rvcilcblx0XHRyZXR1cm4gaW5qZWN0b3JcblxuXG5cdHNldEV4dGVuc2lvbjogKG5hbWUsIGV4dGVuc2lvbikgLT5cblx0XHRAaW5qZWN0b3JGYWN0b3J5LnNldEV4dGVuc2lvbihuYW1lLCBleHRlbnNpb24pXG5cdFx0cmV0dXJuXG5cblxuXHRzZXRDb25maWc6IChjb25maWcpIC0+XG5cdFx0QGluamVjdG9yRmFjdG9yeS5zZXRDb25maWcoY29uZmlnKVxuXHRcdHJldHVyblxuXG5cblxubW9kdWxlLmV4cG9ydHMgPSBDb25maWd1cmF0b3IiLCJDb25maWd1cmF0b3IgPSByZXF1aXJlICcuL0NvbmZpZ3VyYXRvcidcblRyYW5zbGF0b3IgPSByZXF1aXJlICcuLi9sb2NhbGUvVHJhbnNsYXRvcidcblxuXG5jbGFzcyBNaXdvXG5cblx0QHNlcnZpY2U6IChuYW1lLCBzZXJ2aWNlKSAtPlxuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eSBAcHJvdG90eXBlLCBuYW1lLFxuXHRcdFx0Y29uZmlndXJhYmxlOiB5ZXNcblx0XHRcdGdldDooKSAtPiBAc2VydmljZShzZXJ2aWNlIHx8IG5hbWUpXG5cdFx0cmV0dXJuXG5cblx0IyBAcHJvcGVydHkge0VsZW1lbnR9XG5cdGJvZHk6IG51bGxcblxuXHQjIEBwcm9wZXJ0eSB7U3RyaW5nfVxuXHRiYXNlVXJsOiAnJ1xuXG5cdCMgQHByb3BlcnR5IHtNaXdvLmh0dHAuUmVxdWVzdE1hbmFnZXJ9XG5cdGh0dHA6IEBzZXJ2aWNlICdodHRwJ1xuXG5cdCMgQHByb3BlcnR5IHtNaXdvLmh0dHAuUmVxdWVzdE1hbmFnZXJ9XG5cdGNvb2tpZTogQHNlcnZpY2UgJ2Nvb2tpZSdcblxuXHQjIEBwcm9wZXJ0eSB7TWl3by5hcHAuRmxhc2hOb3RpZmljYXRvcn1cblx0Zmxhc2g6IEBzZXJ2aWNlICdmbGFzaCdcblxuXHQjIEBwcm9wZXJ0eSB7TWl3by5jb21wb25lbnQuWkluZGV4TWFuYWdlcn1cblx0ekluZGV4TWdyOiBAc2VydmljZSAnekluZGV4TWdyJ1xuXG5cdCMgQHByb3BlcnR5IHtNaXdvLmRhdGEuU3RvcmVNYW5hZ2VyfVxuXHRzdG9yZU1ncjogQHNlcnZpY2UgJ3N0b3JlTWdyJ1xuXG5cdCMgQHByb3BlcnR5IHtNaXdvLmRhdGEuUHJveHlNYW5hZ2VyfVxuXHRwcm94eU1ncjogQHNlcnZpY2UgJ3Byb3h5TWdyJ1xuXG5cdCMgQHByb3BlcnR5IHtNaXdvLmRhdGEuRW50aXR5TWFuYWdlcn1cblx0ZW50aXR5TWdyOiBAc2VydmljZSAnZW50aXR5TWdyJ1xuXG5cdCMgQHByb3BlcnR5IHtNaXdvLmNvbXBvbmVudC5Db21wb25lbnRNYW5hZ2VyfVxuXHRjb21wb25lbnRNZ3I6IEBzZXJ2aWNlICdjb21wb25lbnRNZ3InXG5cblx0IyBAcHJvcGVydHkge01pd28uY29tcG9uZW50LlN0YXRlTWFuYWdlcn1cblx0Y29tcG9uZW50U3RhdGVNZ3I6IEBzZXJ2aWNlICdjb21wb25lbnRTdGF0ZU1ncidcblxuXHQjIEBwcm9wZXJ0eSB7TWl3by5jb21wb25lbnQuQ29tcG9uZW50U2VsZWN0b3J9XG5cdGNvbXBvbmVudFNlbGVjdG9yOiBAc2VydmljZSAnY29tcG9uZW50U2VsZWN0b3InXG5cblx0IyBAcHJvcGVydHkge01pd28ud2luZG93LldpbmRvd01hbmFnZXJ9XG5cdHdpbmRvd01ncjogQHNlcnZpY2UgJ3dpbmRvd01ncidcblxuXHQjIEBwcm9wZXJ0eSB7TWl3by5hcHAuQXBwbGljYXRpb259XG5cdGFwcGxpY2F0aW9uOiBAc2VydmljZSAnYXBwbGljYXRpb24nXG5cblx0IyBAcHJvcGVydHkge01pd28ubG9jYWxlLlRyYW5zbGF0b3J9XG5cdHRyYW5zbGF0b3I6IG51bGxcblxuXHQjIEBwcm9wZXJ0eSB7TWl3by5kaS5JbmplY3Rvcn1cblx0aW5qZWN0b3I6IG51bGxcblxuXHQjIEBwcm9wZXJ0eSBPYmplY3Rcblx0ZXh0ZW5zaW9uczogbnVsbFxuXG5cblx0Y29uc3RydWN0b3I6IC0+XG5cdFx0QHJlYWR5ICgpID0+IEBib2R5ID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2JvZHknKVswXTtcblx0XHRAZXh0ZW5zaW9ucyA9IHt9XG5cdFx0QHRyYW5zbGF0b3IgPSBuZXcgVHJhbnNsYXRvcigpXG5cdFx0cmV0dXJuXG5cblxuXHQjIFJlZ2lzdGVyIHJlYWR5IGNhbGxiYWNrXG5cdCMgQHBhcmFtIHtGdW5jdGlvbn1cblx0cmVhZHk6IChjYWxsYmFjaykgLT5cblx0XHR3aW5kb3cub24oJ2RvbXJlYWR5JywgY2FsbGJhY2spXG5cdFx0cmV0dXJuXG5cblx0IyBUcmFuc2xhdGUga2V5IGJ5IHRyYW5zbGF0b3Jcblx0IyBAcGFyYW0ge1N0cmluZ30ga2V5XG5cdHRyOiAoa2V5KSAtPlxuXHRcdHJldHVybiBAdHJhbnNsYXRvci5nZXQoa2V5KVxuXG5cblx0IyBSZXF1aXJlIGZpbGUgYnkgYWpheCBhbmQgZXZhbHVhdGUgaXRcblx0IyBAcGFyYW0ge1N0cmluZ30gZmlsZVxuXHRyZXF1aXJlOiAoZmlsZSkgLT5cblx0XHRkYXRhID0gbWl3by5odHRwLnJlYWQoQGJhc2VVcmwrZmlsZStcIj90PVwiKyhuZXcgRGF0ZSgpLmdldFRpbWUoKSkpXG5cdFx0dHJ5XG5cdFx0XHRldmFsKGRhdGEpXG5cdFx0Y2F0Y2ggZVxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiQ2FudCByZXF1aXJlIGZpbGUgI3tmaWxlfSwgZGF0YSBhcmUgbm90IGV2YWx1YWJsZS4gUmVhc29uICN7ZS5nZXRNZXNzYWdlKCl9XCIpXG5cdFx0cmV0dXJuXG5cblxuXHQjIFJlZGlyZWN0IGFwcGxpY2F0aW9uIHRvIG5ldyByZXF1ZXN0XG5cdCMgQHBhcmFtIHtTdHJpbmd9IGNvZGVcblx0IyBAcGFyYW0ge09iamVjdH0gcGFyYW1zXG5cdHJlZGlyZWN0OiAoY29kZSwgcGFyYW1zKSAtPlxuXHRcdEBhcHBsaWNhdGlvbi5yZWRpcmVjdChjb2RlLCBwYXJhbXMpXG5cdFx0cmV0dXJuXG5cblxuXHQjIEdldCBjb21wb25lbnQgYnkgaWRcblx0IyBAcGFyYW0ge1N0cmluZ31cblx0IyBAcmV0dXJuIHtNaXdvLmNvbXBvbmVudC5Db21wb25lbnR9XG5cdGdldDogKGlkKSAtPlxuXHRcdHJldHVybiBAY29tcG9uZW50TWdyLmdldChpZClcblxuXG5cdCMgTWFrZSBhc3luYyBjYWxsYmFjayBjYWxsXG5cdCMgQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcblx0IyBAcmV0dXJuIGludFxuXHRhc3luYzogKGNhbGxiYWNrKSAtPlxuXHRcdHJldHVybiBzZXRUaW1lb3V0ICgpPT5cblx0XHRcdGNhbGxiYWNrKClcblx0XHRcdHJldHVyblxuXHRcdCwxXG5cblxuXHQjIEZpbmQgb25lIGNvbXBvbmVudFxuXHQjIEBwYXJhbSB7U3RyaW5nfVxuXHQjIEByZXR1cm4ge01pd28uY29tcG9uZW50LkNvbXBvbmVudH1cblx0cXVlcnk6IChzZWxlY3RvcikgLT5cblx0XHRmb3IgY29tcG9uZW50IGluIEBjb21wb25lbnRNZ3Iucm9vdHNcblx0XHRcdGlmIGNvbXBvbmVudC5pc0NvbnRhaW5lclxuXHRcdFx0XHRyZXN1bHQgPSBAY29tcG9uZW50U2VsZWN0b3IucXVlcnkoc2VsZWN0b3IsIGNvbXBvbmVudClcblx0XHRcdFx0aWYgcmVzdWx0IHRoZW4gcmV0dXJuIHJlc3VsdFxuXHRcdFx0ZWxzZSBpZiBjb21wb25lbnQuaXMoc2VsZWN0b3IpXG5cdFx0XHRcdHJldHVybiBjb21wb25lbnRcblx0XHRyZXR1cm4gbnVsbFxuXG5cblx0IyBGaW5kIG1vcmUgY29tcG9uZW50c1xuXHQjIEBwYXJhbSB7U3RyaW5nfVxuXHQjIEByZXR1cm4ge1tNaXdvLmNvbXBvbmVudC5Db21wb25lbnRdfVxuXHRxdWVyeUFsbDogKHNlbGVjdG9yKSAtPlxuXHRcdHJlc3VsdHMgPSBbXVxuXHRcdGZvciBjb21wb25lbnQgaW4gQGNvbXBvbmVudE1nci5yb290c1xuXHRcdFx0aWYgY29tcG9uZW50LmlzQ29udGFpbmVyXG5cdFx0XHRcdHJlc3VsdHMuYXBwZW5kKEBjb21wb25lbnRTZWxlY3Rvci5xdWVyeUFsbChzZWxlY3RvciwgY29tcG9uZW50KSlcblx0XHRcdGVsc2UgaWYgY29tcG9uZW50LmlzKHNlbGVjdG9yKVxuXHRcdFx0XHRyZXN1bHRzLnB1c2goY29tcG9uZW50KVxuXHRcdHJldHVybiByZXN1bHRzXG5cblxuXHQjIEdldCBzZXJ2aWNlIGZyb20gaW5qZWN0b3Jcblx0IyBAcGFyYW0ge1N0cmluZ30gbmFtZVxuXHQjIEByZXR1cm5zIHtPYmplY3R9XG5cdHNlcnZpY2U6IChuYW1lKSAtPlxuXHRcdHJldHVybiBAaW5qZWN0b3IuZ2V0KG5hbWUpXG5cblxuXHQjIEdldCBzdG9yZVxuXHQjIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG5cdCMgQHJldHVybnMge01pd28uZGF0YS5TdG9yZX1cblx0c3RvcmU6IChuYW1lKSAtPlxuXHRcdHJldHVybiBAc3RvcmVNZ3IuZ2V0KG5hbWUpXG5cblxuXHQjIEdldCBzdG9yZVxuXHQjIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG5cdCMgQHJldHVybnMge01pd28uZGF0YS5TdG9yZX1cblx0cHJveHk6IChuYW1lKSAtPlxuXHRcdHJldHVybiBAcHJveHlNZ3IuZ2V0KG5hbWUpXG5cblxuXHQjIFJlZ2lzdGVyIERJIGV4dGVuc2lvbiBjbGFzc1xuXHQjIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFVuaXF1ZSBuYW1lIG9mIGV4dGVuc2lvblxuXHQjIEBwYXJhbSB7TWl3by5kaS5JbmplY3RvckV4dGVuc2lvbn0gZXh0ZW5zaW9uIEV4dGVuc2lvbiBjbGFzc1xuXHRyZWdpc3RlckV4dGVuc2lvbjogKG5hbWUsIGV4dGVuc2lvbikgLT5cblx0XHRAZXh0ZW5zaW9uc1tuYW1lXSA9IGV4dGVuc2lvblxuXHRcdHJldHVyblxuXG5cblx0IyBDcmVhdGVzIGRlZmF1bHQgY29uZmlndXJhdG9yXG5cdCMgQHJldHVybnMge01pd28uYm9vdHN0cmFwLkNvbmZpZ3VyYXRvcn1cblx0Y3JlYXRlQ29uZmlndXJhdG9yOiAoKSAtPlxuXHRcdGNvbmZpZ3VyYXRvciA9IG5ldyBDb25maWd1cmF0b3IodGhpcylcblx0XHRmb3IgbmFtZSxleHRlbnNpb24gb2YgQGV4dGVuc2lvbnNcblx0XHRcdGNvbmZpZ3VyYXRvci5zZXRFeHRlbnNpb24obmFtZSwgbmV3IGV4dGVuc2lvbigpKVxuXHRcdHJldHVybiBjb25maWd1cmF0b3JcblxuXG5cdCMgU2V0IGluamVjdG9yIChjYWxsZWQgYnkgQ29uZmlndXJhdG9yKVxuXHQjIEBwYXJhbSB7TWl3by5kaS5JbmplY3Rvcn1cblx0c2V0SW5qZWN0b3I6IChAaW5qZWN0b3IpIC0+XG5cdFx0QGluamVjdG9yLnNldCgndHJhbnNsYXRvcicsIEB0cmFuc2xhdG9yKVxuXHRcdGZvciBuYW1lLCBzZXJ2aWNlIG9mIGluamVjdG9yLmdsb2JhbHNcblx0XHRcdE1pd28uc2VydmljZShuYW1lLCBzZXJ2aWNlKSAjIGNyZWF0ZSBzZXJ2aWNlIGdldHRlclxuXHRcdHJldHVyblxuXG5cblx0aW5pdDogKG9uSW5pdCktPlxuXHRcdGlmIEBpbmplY3RvciB0aGVuIHJldHVybiBAaW5qZWN0b3Jcblx0XHRjb25maWd1cmF0b3IgPSBAY3JlYXRlQ29uZmlndXJhdG9yKClcblx0XHRvbkluaXQoY29uZmlndXJhdG9yKSBpZiBvbkluaXRcblx0XHRpbmplY3RvciA9IGNvbmZpZ3VyYXRvci5jcmVhdGVJbmplY3RvcigpXG5cdFx0cmV0dXJuIGluamVjdG9yXG5cblxuIyBnbG9iYWwgb2JqZWN0XG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBNaXdvIiwiTWl3b09iamVjdCA9IHJlcXVpcmUgJy4uL2NvcmUvT2JqZWN0J1xuXG5cbmNsYXNzIENvbXBvbmVudCBleHRlbmRzIE1pd29PYmplY3RcblxuXHQjIEBwcm9wZXJ0eSB7Qm9vbGVhbn0gdHJ1ZSBpbiB0aGlzIGNsYXNzIHRvIGlkZW50aWZ5IGFuIG9iamVjdCBhcyBhbiBpbnN0YW50aWF0ZWQgQ29tcG9uZW50LCBvciBzdWJjbGFzcyB0aGVyZW9mLlxuXHRpc0NvbXBvbmVudDogdHJ1ZVxuXG5cdCMgQGNvbmZpZyB7U3RyaW5nfVxuXHR4dHlwZTogJ2NvbXBvbmVudCdcblxuXHQjIEBjb25maWcge1N0cmluZ31cblx0aWQ6IG51bGxcblxuXHQjIEBjb25maWcge1N0cmluZ31cblx0bmFtZTogbnVsbFxuXG5cdCMgQGNvbmZpZyB7U3RyaW5nfE51bWJlcn1cblx0d2lkdGg6IHVuZGVmaW5lZFxuXG5cdCMgQGNvbmZpZyB7U3RyaW5nfE51bWJlcn1cblx0aGVpZ2h0OiB1bmRlZmluZWRcblxuXHQjIEBjb25maWcge1N0cmluZ3xOdW1iZXJ9XG5cdHRvcDogbnVsbFxuXG5cdCMgQGNvbmZpZyB7U3RyaW5nfE51bWJlcn1cblx0bGVmdDogbnVsbFxuXG5cdCMgQGNvbmZpZyB7U3RyaW5nfE51bWJlcn1cblx0cmlnaHQ6IG51bGxcblxuXHQjIEBjb25maWcge1N0cmluZ3xOdW1iZXJ9XG5cdGJvdHRvbTogbnVsbFxuXG5cdCMgQGNvbmZpZyB7U3RyaW5nfE51bWJlcn1cblx0cGFkZGluZzogbnVsbFxuXG5cdCMgQGNvbmZpZyB7U3RyaW5nfE51bWJlcn1cblx0bWFyZ2luOiBudWxsXG5cblx0IyBAY29uZmlnIHtTdHJpbmd9XG5cdGh0bWw6IG51bGxcblxuXHQjIEBjb25maWcge09iamVjdH1cblx0c3R5bGVzOiBudWxsXG5cblx0IyBAY29uZmlnIHtTdHJpbmd9XG5cdGNsczogbnVsbFxuXG5cdCMgQGNvbmZpZyB7U3RyaW5nfVxuXHRiYXNlQ2xzOiBcIlwiXG5cblx0IyBAY29uZmlnIHtTdHJpbmd9XG5cdGNvbXBvbmVudENsczogXCJcIlxuXG5cdCMgQHByb3BlcnR5IHtNaXdvLmNvbXBvbmVudC5Db250YWluZXJ9XG5cdGNvbnRhaW5lcjogbnVsbFxuXG5cdCMgQGNvbmZpZyB7U3RyaW5nfE9iamVjdH1cblx0IyBAcHJvcGVydHkge0VsZW1lbnR9XG5cdGVsOiBcImRpdlwiXG5cblx0IyBAY29uZmlnIHtTdHJpbmd8T2JqZWN0fVxuXHQjIEBwcm9wZXJ0eSB7RWxlbWVudH1cblx0Y29udGVudEVsOiBudWxsXG5cblx0IyBAcHJvcGVydHkge0VsZW1lbnR9XG5cdHBhcmVudEVsOiBudWxsXG5cblx0IyBAcHJvcGVydHkge0VsZW1lbnR9XG5cdGZvY3VzRWw6IG51bGxcblxuXHQjIEBwcm9wZXJ0eSB7Qm9vbGVhbn1cblx0cmVuZGVyZWQ6IGZhbHNlXG5cblx0IyBAcHJvcGVydHkge0Jvb2xlYW59XG5cdHJlbmRlcmluZzogZmFsc2VcblxuXHQjIEBwcm9wZXJ0eSB7Qm9vbGVhbn1cblx0YXV0b0ZvY3VzOiBmYWxzZVxuXG5cdCMgQHByb3BlcnR5IHtOdW1iZXJ9XG5cdHpJbmRleDogbnVsbFxuXG5cdCMgQHByb3BlcnR5IHtCb29sZWFufVxuXHR6SW5kZXhNYW5hZ2U6IGZhbHNlXG5cblx0IyBAcHJvcGVydHkge0Jvb2xlYW59XG5cdGZvY3VzT25Ub0Zyb250OiB0cnVlXG5cblx0IyBAcHJvcGVydHkge0Jvb2xlYW59XG5cdGZvY3VzOiBmYWxzZVxuXG5cdCMgQHByb3BlcnR5IHtCb29sZWFufVxuXHR2aXNpYmxlOiB0cnVlXG5cblx0IyBAcHJvcGVydHkge0VsZW1lbnR9XG5cdHJlbmRlclRvOiBudWxsXG5cblx0IyBAY29uZmlnIHtTdHJpbmd9XG5cdCMgQHByb3BlcnR5IHtNaXdvLnRlbXBsYXRlcy5UZW1wbGF0ZX1cblx0dGVtcGxhdGU6IG51bGxcblxuXHQjIEBwcm9wZXJ0eSB7Qm9vbGVhbn1cblx0c2Nyb2xsYWJsZTogZmFsc2VcblxuXHQjIEBwcm9wZXJ0eSB7Qm9vbGVhbn1cblx0YXV0b0NlbnRlcjogZmFsc2VcblxuXHQjIEBwcm9wZXJ0eSB7Qm9vbGVhbn1cblx0ZGlzYWJsZWQ6IGZhbHNlXG5cblx0IyBAcHJvcGVydHkge1N0cmluZ31cblx0cm9sZTogbnVsbFxuXG5cdCMgQHByb3BlcnR5IHtPYmplY3R9XG5cdHBsdWdpbnM6IG51bGxcblxuXHQjIEBwcm9wZXJ0eSB7Qm9vbGVhbn1cblx0c3RhdGVNYW5hZ2U6IGZhbHNlXG5cblx0IyBAcHJvcGVydHkge1N0cmluZ31cblx0c3RhdGVOYW1lOiBudWxsXG5cblx0X2lzR2VuZXJhdGVkSWQ6IGZhbHNlXG5cdHpJbmRleE1ncjogbnVsbFxuXHRjb21wb25lbnRNZ3I6IG51bGxcblxuXG5cdGNvbnN0cnVjdG9yOiAoY29uZmlnKSAtPlxuXHRcdEBwbHVnaW5zID0ge31cblxuXHRcdCMgY3VzdG9tIGluaXRpYWxpemUgY29tcG9uZW50IChzZXR1cCBvcHRpb25zKVxuXHRcdEBiZWZvcmVJbml0KClcblx0XHRpZiAhQGNhbGxlZEJlZm9yZUluaXQgdGhlbiB0aHJvdyBuZXcgRXJyb3IoXCJJbiBjb21wb25lbnQgI3tAfSB5b3UgZm9yZ290IGNhbGwgc3VwZXI6OmJlZm9yZUluaXQoKVwiKVxuXG5cdFx0IyBzZXQgb3B0aW9ucyAoY2FuIGJ5IG92ZXJyaWRlIGluIGRvSW5pdClcblx0XHRzdXBlcihjb25maWcpXG5cblx0XHQjIGluaXRpYWxpemUgY29tcG9uZW50IHByb3BlcnRpZXNcblx0XHRAZG9Jbml0KClcblx0XHRpZiAhQGNhbGxlZERvSW5pdCB0aGVuIHRocm93IG5ldyBFcnJvcihcIkluIGNvbXBvbmVudCAje0B9IHlvdSBmb3Jnb3QgY2FsbCBzdXBlcjo6ZG9Jbml0KClcIilcblxuXHRcdCMgcmVnaXN0ZXIgY29tcG9uZW50IGludG8gbWFuYWdlcnNcblx0XHRtaXdvLmNvbXBvbmVudE1nci5yZWdpc3Rlcih0aGlzKVxuXHRcdG1pd28uekluZGV4TWdyLnJlZ2lzdGVyKHRoaXMpICBpZiBAekluZGV4TWFuYWdlXG5cblx0XHQjIGluaXRpYWxpemUgY29tcG9uZW50IGFmdGVyIGFsbCBvcHRpb25zIGFuZCBwcm9wZXJ0aWVzIHNldHVwZWRcblx0XHRAYWZ0ZXJJbml0KClcblx0XHRpZiAhQGNhbGxlZEFmdGVySW5pdCB0aGVuIHRocm93IG5ldyBFcnJvcihcIkluIGNvbXBvbmVudCAje0B9IHlvdSBmb3Jnb3QgY2FsbCBzdXBlcjo6YWZ0ZXJJbml0KClcIilcblx0XHRAY2FsbFBsdWdpbnMoJ2luaXQnLCB0aGlzKVxuXHRcdHJldHVyblxuXG5cblx0YmVmb3JlSW5pdDogLT5cblx0XHRAY2FsbGVkQmVmb3JlSW5pdCA9IHRydWVcblx0XHRyZXR1cm5cblxuXG5cdCMgSW5pdGlhbGl6ZSBjb21wb25lbnQgcHJvcGVydGllcyBieSBjb25maWd1cmF0aW9uXG5cdGRvSW5pdDogLT5cblx0XHRAY2FsbGVkRG9Jbml0ID0gdHJ1ZVxuXG5cdFx0IyBnZW5lcmF0ZSBuYW1lIGlmIG5hbWUgaXMgbWlzc2luZ1xuXHRcdGlmICFAbmFtZVxuXHRcdFx0QG5hbWUgPSBtaXdvLmNvbXBvbmVudE1nci51bmlxdWVOYW1lKEB4dHlwZSlcblxuXHRcdCMgZ2VuZXJhdGUgaWQgaWYgaWQgaXMgbWlzc2luZ1xuXHRcdGlmICFAaWRcblx0XHRcdEBpZCA9IG1pd28uY29tcG9uZW50TWdyLnVuaXF1ZUlkKClcblx0XHRcdEBfaXNHZW5lcmF0ZWRJZCA9IHRydWVcblxuXHRcdCMgY3JlYXRlIGJhc2UgZWxlbWVudFxuXHRcdEBlbCA9IEBjcmVhdGVFbGVtZW50KEBlbClcblxuXHRcdCMgY3JlYXRlIGNvbnRlbnQgZWxlbWVudFxuXHRcdGlmIEBjb250ZW50RWxcblx0XHRcdEBjb250ZW50RWwgPSBAY3JlYXRlRWxlbWVudChAY29udGVudEVsKVxuXHRcdFx0QGNvbnRlbnRFbC5pbmplY3QoQGVsKVxuXHRcdFx0QGNvbnRlbnRFbC5hZGRDbGFzcyhcIm1pd28tY3RcIilcblxuXHRcdCMgc2V0IGRlZmF1bHQgZm9jdXMgZWxlbWVudFxuXHRcdGlmIEBmb2N1c0VsIGlzIHRydWVcblx0XHRcdEBmb2N1c0VsID0gQGVsXG5cblx0XHRpZiBAc3RhdGVNYW5hZ2Vcblx0XHRcdHN0YXRlTmFtZSA9IEBzdGF0ZU5hbWUgfHwgQGlkXG5cdFx0XHRpZiAhc3RhdGVOYW1lXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihcIkNvbXBvbmVudCBpZCBvciBzdGF0ZU5hbWUgbXVzdCBiZSBkZWZpbmVkIGlmIHlvdSB3YW50IHVzZSBjb21wb25lbnQgc3RhdGVzXCIpXG5cdFx0XHRAc3RhdGUgPSBtaXdvLmNvbXBvbmVudFN0YXRlTWdyLmxvYWRTdGF0ZShzdGF0ZU5hbWUpXG5cdFx0cmV0dXJuXG5cblxuXHQjIEFmdGVyIGluaXQgbWFuaXB1bGF0aW9uIHdpdGggY29tcG9uZW50XG5cdCMgQHByb3RlY3RlZFxuXHRhZnRlckluaXQ6IC0+XG5cdFx0QGNhbGxlZEFmdGVySW5pdCA9IHRydWVcblx0XHRpZiBAY29tcG9uZW50XG5cdFx0XHRwYXJlbnQgPSBAY29tcG9uZW50XG5cdFx0XHRkZWxldGUgQGNvbXBvbmVudFxuXHRcdFx0cGFyZW50LmFkZENvbXBvbmVudCh0aGlzKVxuXHRcdHJldHVyblxuXG5cblx0IyBDcmVhdGVzIGVsZW1lbnQgYnkgY29uZmlnXG5cdCMgQHBhcmFtIHtPYmplY3R8U3RyaW5nfSBvcHRpb25zXG5cdCMgQHJldHVybiB7RWxlbWVudH1cblx0Y3JlYXRlRWxlbWVudDogKG9wdGlvbnMpIC0+XG5cdFx0aWYgVHlwZS5pc1N0cmluZyhvcHRpb25zKVxuXHRcdFx0cmV0dXJuIG5ldyBFbGVtZW50KG9wdGlvbnMpXG5cdFx0ZWxzZVxuXHRcdFx0dGFnID0gb3B0aW9ucy50YWcgb3IgXCJkaXZcIlxuXHRcdFx0ZGVsZXRlIG9wdGlvbnMudGFnXG5cdFx0XHRyZXR1cm4gbmV3IEVsZW1lbnQodGFnLCBvcHRpb25zKVxuXG5cblx0I1xuXHQjIENvbW1vbiBiYXNpYyBtZXRob2RzIHRvIGFjY2VzcyB0byBlbGVtZW50c1xuXHQjXG5cblxuXHRzZXRJZDogKGlkKSAtPlxuXHRcdEBfaXNHZW5lcmF0ZWRJZCA9IGZhbHNlXG5cdFx0b2xkSWQgPSBAaWRcblx0XHRpZiBAaWQgaXNudCBpZFxuXHRcdFx0QGlkID0gaWRcblx0XHRcdEBlbC5zZXQoXCJpZFwiLCBpZClcblx0XHRcdEBlbWl0KCdpZGNoYW5nZScsIHRoaXMsIGlkLCBvbGRJZClcblx0XHRyZXR1cm5cblxuXG5cdGdldE5hbWU6IC0+XG5cdFx0cmV0dXJuIEBuYW1lXG5cblxuXHRnZXRCYXNlQ2xzOiAoc3VmZml4KSAtPlxuXHRcdHJldHVybiBAYmFzZUNscyArICgoaWYgc3VmZml4IHRoZW4gXCItXCIgKyBzdWZmaXggZWxzZSBcIlwiKSlcblxuXG5cdGdldENvbnRlbnRFbDogLT5cblx0XHRyZXR1cm4gQGNvbnRlbnRFbCBvciBAZWxcblxuXG5cdHNldENvbnRlbnRFbDogKGVsKSAtPlxuXHRcdEBjb250ZW50RWwgPSBlbFxuXHRcdHJldHVyblxuXG5cblx0Z2V0Rm9jdXNFbDogLT5cblx0XHRAZm9jdXNFbFxuXG5cblx0IyMjIG5vdCBzYXZlIG1ldGhvZFxuICAgIHNldEVsOiAoZWwpIC0+XG5cdFx0QGVsID0gZWxcblx0XHRAY29udGVudEVsLmluamVjdChlbCkgaWYgQGNvbnRlbnRFbFxuXHRcdHJldHVyblxuXHQjIyNcblxuXG5cdHNldFBhcmVudEVsOiAoZWwsIHBvc2l0aW9uKSAtPlxuXHRcdEBwYXJlbnRFbCA9IChpZiBwb3NpdGlvbiBpcyBcImFmdGVyXCIgb3IgcG9zaXRpb24gaXMgXCJiZWZvcmVcIiB0aGVuIGVsLmdldFBhcmVudCgpIGVsc2UgZWwpXG5cdFx0QGVsLmluamVjdChlbCwgcG9zaXRpb24pXG5cdFx0cmV0dXJuXG5cblxuXHRnZXRQYXJlbnRFbDogLT5cblx0XHRyZXR1cm4gQHBhcmVudEVsXG5cblxuXHRnZXRFbGVtZW50OiAoc2VsZWN0b3IpIC0+XG5cdFx0cmV0dXJuIEBlbC5nZXRFbGVtZW50KHNlbGVjdG9yKVxuXG5cblx0Z2V0RWxlbWVudHM6IChzZWxlY3RvcikgLT5cblx0XHRyZXR1cm4gQGVsLmdldEVsZW1lbnRzKHNlbGVjdG9yKVxuXG5cblx0I1xuXHQjIFotaW5kZXggbWFuYWdpbmdcblx0I1xuXG5cblx0c2V0WkluZGV4OiAoekluZGV4KSAtPlxuXHRcdEBlbC5zZXRTdHlsZShcInotaW5kZXhcIiwgekluZGV4KVxuXHRcdHJldHVybiB6SW5kZXggKyAxMFxuXG5cblx0Z2V0WkluZGV4OiAtPlxuXHRcdHJldHVybiBwYXJzZUludChAZWwuZ2V0U3R5bGUoXCJ6LWluZGV4XCIpLCAxMClcblxuXG5cdHRvRnJvbnQ6IC0+XG5cdFx0QGdldFpJbmRleE1hbmFnZXIoKS5icmluZ1RvRnJvbnQodGhpcylcblx0XHRyZXR1cm5cblxuXG5cdHRvQmFjazogLT5cblx0XHRAZ2V0WkluZGV4TWFuYWdlcigpLnNlbmRUb0JhY2sodGhpcylcblx0XHRyZXR1cm5cblxuXG5cdGdldFpJbmRleE1hbmFnZXI6IC0+XG5cdFx0aWYgIUB6SW5kZXhNZ3IgdGhlbiB0aHJvdyBuZXcgRXJyb3IoXCJDb21wb25lbnQgI3tAbmFtZX0gaXMgbm90IG1hbmFnZWQgd2l0aCB6SW5kZXhNYW5hZ2VyXCIpXG5cdFx0cmV0dXJuIEB6SW5kZXhNZ3JcblxuXG5cdCNcblx0IyBDb21wb25lbnQgc3RhdGVcblx0I1xuXG5cblx0c2V0QWN0aXZlOiAoYWN0aXZlLCBuZXdBY3RpdmUpIC0+XG5cdFx0QGVtaXQoKGlmIGFjdGl2ZSB0aGVuIFwiYWN0aXZhdGVkXCIgZWxzZSBcImRlYWN0aXZhdGVkXCIpLCB0aGlzKVxuXHRcdHJldHVyblxuXG5cblx0c2V0RGlzYWJsZWQ6IChkaXNhYmxlZCkgLT5cblx0XHRAZGlzYWJsZWQgPSBkaXNhYmxlZFxuXHRcdEBlbWl0KFwiZGlzYWJsZWRcIiwgdGhpcywgZGlzYWJsZWQpXG5cdFx0QGdldEZvY3VzRWwoKS5zZXQoJ3RhYmluZGV4JywgLWRpc2FibGVkKSBpZiBAaXNGb2N1c2FibGUoKVxuXHRcdHJldHVyblxuXG5cblx0c2V0Rm9jdXM6IChzaWxlbnQpIC0+XG5cdFx0aWYgQGRpc2FibGVkIHRoZW4gcmV0dXJuXG5cdFx0QGZvY3VzID0gdHJ1ZVxuXHRcdEBnZXRGb2N1c0VsKCkuc2V0Rm9jdXMoKSBpZiBAaXNGb2N1c2FibGUoKVxuXHRcdEBlbWl0KCdmb2N1cycsIHRoaXMpIGlmICFzaWxlbnRcblx0XHRyZXR1cm5cblxuXG5cdGJsdXI6IChzaWxlbnQpIC0+XG5cdFx0aWYgQGRpc2FibGVkIHRoZW4gcmV0dXJuXG5cdFx0QGZvY3VzID0gZmFsc2Vcblx0XHRAZ2V0Rm9jdXNFbCgpLmJsdXIoKSBpZiBAaXNGb2N1c2FibGUoKVxuXHRcdEBlbWl0KCdibHVyJywgdGhpcykgaWYgIXNpbGVudFxuXHRcdHJldHVyblxuXG5cblx0aXNGb2N1c2FibGU6IC0+XG5cdFx0cmV0dXJuIEBmb2N1c0VsIGFuZCBAcmVuZGVyZWQgYW5kIEBpc1Zpc2libGUoKVxuXG5cblx0aXNTY3JvbGxhYmxlOiAtPlxuXHRcdGlmIEBzY3JvbGxhYmxlIGlzIG51bGxcblx0XHRcdCMgYnkgZGVmYXVsdCBzY3JvbGxhYmxlXG5cdFx0XHRyZXR1cm4gQGhlaWdodCBvciAoQHRvcCBpc250IG51bGwgYW5kIEBib3R0b20gaXNudCBudWxsKVxuXHRcdGVsc2Vcblx0XHRcdCMgYnkgcHJvcGVydHlcblx0XHRcdHJldHVybiAgQHNjcm9sbGFibGVcblxuXG5cdCNcblx0IyBDb21wb25lbnRzIG1vZGVsXG5cdCNcblxuXG5cdHNldFBhcmVudDogKHBhcmVudCwgbmFtZSkgLT5cblx0XHRpZiBwYXJlbnQgaXMgbnVsbCBhbmQgQGNvbnRhaW5lciBpcyBudWxsIGFuZCBuYW1lIGlzbnQgbnVsbFxuXHRcdFx0QG5hbWUgPSBuYW1lICMganVzdCByZW5hbWVcblx0XHRcdHJldHVybiB0aGlzXG5cdFx0ZWxzZSBpZiBwYXJlbnQgaXMgQGNvbnRhaW5lciBhbmQgbmFtZSBpcyBudWxsICMgbm90aGluZyB0byBkb1xuXHRcdFx0cmV0dXJuIHRoaXNcblxuXHRcdCMgQSBjb21wb25lbnQgY2Fubm90IGJlIGdpdmVuIGEgcGFyZW50IGlmIGl0IGFscmVhZHkgaGFzIGEgcGFyZW50LlxuXHRcdGlmIEBjb250YWluZXIgaXNudCBudWxsIGFuZCBwYXJlbnQgaXNudCBudWxsXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJDb21wb25lbnQgJyN7QG5hbWV9JyBhbHJlYWR5IGhhcyBhIHBhcmVudCAnI3tAY29udGFpbmVyLm5hbWV9JyBhbmQgeW91IHRyeSBzZXQgbmV3IHBhcmVudCAnI3twYXJlbnQubmFtZX0nLlwiKVxuXG5cdFx0IyBTZXQgb3Igb3ZlcndyaXRlIG5hbWVcblx0XHRpZiBuYW1lIHRoZW4gQG5hbWUgPSBuYW1lXG5cblx0XHQjIGFkZC9yZW1vdmUgcGFyZW50XG5cdFx0aWYgcGFyZW50IGlzbnQgbnVsbFxuXHRcdFx0QGNvbnRhaW5lciA9IHBhcmVudFxuXHRcdFx0QGF0dGFjaGVkQ29udGFpbmVyKEBjb250YWluZXIpXG5cdFx0XHRAZW1pdCgnYXR0YWNoZWQnLCB0aGlzLCBwYXJlbnQpXG5cdFx0ZWxzZVxuXHRcdFx0QGRldGFjaGVkQ29udGFpbmVyKEBjb250YWluZXIpXG5cdFx0XHRAZW1pdCgnZGV0YWNoZWQnLCB0aGlzKVxuXHRcdFx0QGNvbnRhaW5lciA9IG51bGxcblx0XHRyZXR1cm4gdGhpc1xuXG5cblx0aXM6IChzZWxlY3RvcikgLT5cblx0XHRyZXR1cm4gbWl3by5jb21wb25lbnRTZWxlY3Rvci5pcyh0aGlzLCBzZWxlY3RvcilcblxuXG5cdGlzWHR5cGU6ICh4dHlwZSkgLT5cblx0XHRyZXR1cm4gIEB4dHlwZSBpcyB4dHlwZVxuXG5cblx0Z2V0UGFyZW50OiAoc2VsZWN0b3IpIC0+XG5cdFx0cmV0dXJuIGlmIHNlbGVjdG9yIHRoZW4gbWl3by5jb21wb25lbnRTZWxlY3Rvci5xdWVyeVBhcmVudCh0aGlzLCBzZWxlY3RvcikgZWxzZSBAY29udGFpbmVyXG5cblxuXHRuZXh0U2libGluZzogLT5cblx0XHRyZXR1cm4gQGdldFBhcmVudCgpLm5leHRTaWJsaW5nT2YodGhpcylcblxuXG5cdHByZXZpb3VzU2libGluZzogLT5cblx0XHRyZXR1cm4gQGdldFBhcmVudCgpLnByZXZpb3VzU2libGluZ09mKHRoaXMpXG5cblxuXHQjIGNhbGxlZCB3aGVuIGNvbXBvbmVudCBpcyBhdHRhY2hlZCB0byBwYXJlbnRcblx0YXR0YWNoZWRDb250YWluZXI6IChwYXJlbnQpIC0+XG5cdFx0cmV0dXJuXG5cblxuXHQjIGNhbGxlZCB3aGVuIGNvbXBvbmVudCBpcyBkZXRhY2hlZCBmcm9tIHBhcmVudFxuXHRkZXRhY2hlZENvbnRhaW5lcjogKHBhcmVudCkgLT5cblx0XHRyZXR1cm5cblxuXG5cdCNcblx0IyBQbHVnaW5zXG5cdCNcblxuXG5cdGluc3RhbGxQbHVnaW46IChuYW1lLCBwbHVnaW4pIC0+XG5cdFx0aWYgQHBsdWdpbnNbbmFtZV0gdGhlbiB0aHJvdyBuZXcgRXJyb3IoXCJQbHVnaW4gI3tuYW1lfSBhbHJlYWR5IGluc3RhbGxlZCBpbiBjb21wb25lbnQgI3t0aGlzfVwiKVxuXHRcdEBwbHVnaW5zW25hbWVdID0gcGx1Z2luXG5cdFx0cmV0dXJuXG5cblxuXHR1bmluc3RhbGxQbHVnaW46IChuYW1lKSAtPlxuXHRcdGlmICFAcGx1Z2luc1tuYW1lXSB0aGVuIHJldHVyblxuXHRcdEBwbHVnaW5zW25hbWVdLmRlc3Ryb3koKVxuXHRcdGRlbGV0ZSBAcGx1Z2luc1tuYW1lXVxuXHRcdHJldHVyblxuXG5cblx0Z2V0UGx1Z2luOiAobmFtZSkgLT5cblx0XHRpZiAhQHBsdWdpbnNbbmFtZV0gdGhlbiB0aHJvdyBuZXcgRXJyb3IoXCJQbHVnaW4gI3tuYW1lfSBpcyBub3QgaW5zdGFsbGVkIGluIGNvbXBvbmVudCAje3RoaXN9XCIpXG5cdFx0cmV0dXJuIEBwbHVnaW5zW25hbWVdXG5cblxuXHRoYXNQbHVnaW46IChuYW1lKSAtPlxuXHRcdHJldHVybiBAcGx1Z2luc1tuYW1lXSBpc250IHVuZGVmaW5lZFxuXG5cblx0Y2FsbFBsdWdpbnM6IChtZXRob2QsIGFyZ3MuLi4pIC0+XG5cdFx0Zm9yIG5hbWUscGx1Z2luIG9mIEBwbHVnaW5zXG5cdFx0XHRpZiBwbHVnaW5bbWV0aG9kXVxuXHRcdFx0XHRwbHVnaW5bbWV0aG9kXS5hcHBseShwbHVnaW4sIGFyZ3MpXG5cdFx0cmV0dXJuXG5cblxuXHQjXG5cdCMgUmVuZGVyaW5nXG5cdCNcblxuXG5cdGhhc1RlbXBsYXRlOiAtPlxuXHRcdHJldHVybiBAdGVtcGxhdGUgaXNudCBudWxsXG5cblxuXHRnZXRUZW1wbGF0ZTogLT5cblx0XHRpZiBAdGVtcGxhdGUgYW5kIFR5cGUuaXNTdHJpbmcoQHRlbXBsYXRlKVxuXHRcdFx0QHRlbXBsYXRlID0gQGNyZWF0ZVRlbXBsYXRlKEB0ZW1wbGF0ZSlcblx0XHRyZXR1cm4gQHRlbXBsYXRlXG5cblxuXHRjcmVhdGVUZW1wbGF0ZTogKHNvdXJjZSkgLT5cblx0XHR0ZW1wbGF0ZSA9IG1pd28uc2VydmljZSgndGVtcGxhdGVGYWN0b3J5JykuY3JlYXRlVGVtcGxhdGUoKVxuXHRcdHRlbXBsYXRlLnNldFNvdXJjZShzb3VyY2UpXG5cdFx0dGVtcGxhdGUuc2V0VGFyZ2V0KEBnZXRDb250ZW50RWwoKSlcblx0XHR0ZW1wbGF0ZS5zZXQoXCJtZVwiLCB0aGlzKVxuXHRcdHRlbXBsYXRlLnNldChcImNvbXBvbmVudFwiLCB0aGlzKVxuXHRcdHJldHVybiB0ZW1wbGF0ZVxuXG5cblx0dXBkYXRlOiAtPlxuXHRcdHJldHVybiB0aGlzXG5cblxuXHRyZXNldFJlbmRlcmVkOiAoZGlzcG9zZSkgLT5cblx0XHRAcmVuZGVyZWQgPSBmYWxzZVxuXHRcdEBwYXJlbnRFbCA9IG51bGxcblx0XHRpZiBkaXNwb3NlXG5cdFx0XHRAZWwuZW1wdHkoKVxuXHRcdFx0QGVsLmRpc3Bvc2UoKVxuXHRcdHJldHVybiB0aGlzXG5cblxuXHRyZW5kZXI6IChlbCwgcG9zaXRpb24pIC0+XG5cdFx0ZWwgPSBAcmVuZGVyVG8gaWYgQHJlbmRlclRvXG5cdFx0aWYgQHJlbmRlcmVkIHRoZW4gcmV0dXJuXG5cblx0XHRpZiBwb3NpdGlvbiBpcyAncmVwbGFjZSdcblx0XHRcdEBlbC5yZXBsYWNlcygkKGVsKSlcblx0XHRcdEBwYXJlbnRFbCA9IEBlbC5nZXRQYXJlbnQoKVxuXHRcdGVsc2Vcblx0XHRcdGlmIGVsIGFuZCAhQHBhcmVudEVsIHRoZW4gQHNldFBhcmVudEVsKGVsLCBwb3NpdGlvbilcblxuXHRcdCMgY2FsbCBiZWZvcmUgcmVuZGVyaW5nIHN0YXJ0ZWRcblx0XHRAYmVmb3JlUmVuZGVyKClcblx0XHRpZiAhQGNhbGxlZEJlZm9yZVJlbmRlciB0aGVuIHRocm93IG5ldyBFcnJvcihcIkluIGNvbXBvbmVudCAje0B9IHlvdSBmb3Jnb3QgY2FsbCBzdXBlcjo6YmVmb3JlUmVuZGVyKClcIilcblx0XHRAY2FsbFBsdWdpbnMoJ2JlZm9yZVJlbmRlcicsIHRoaXMpXG5cblx0XHQjIGZpbmQgY29udGVudEVsIGFuZCB0cnkgdG8gY2hhbmdlXG5cdFx0Y29udGVudEVsID0gQGdldEVsZW1lbnQoJ1ttaXdvLXJlZmVyZW5jZT1cImNvbnRlbnRFbFwiXScpXG5cdFx0QGNvbnRlbnRFbCA9IGNvbnRlbnRFbCAgaWYgY29udGVudEVsXG5cblx0XHRAZHJhd0NvbXBvbmVudCgpXG5cdFx0cmV0dXJuIHRoaXNcblxuXG5cdHJlcGxhY2U6ICh0YXJnZXQpIC0+XG5cdFx0dGFyZ2V0ID0gdGFyZ2V0IHx8ICQoQGlkKVxuXHRcdEByZW5kZXIodGFyZ2V0LCAncmVwbGFjZScpIGlmIHRhcmdldFxuXHRcdHJldHVybiB0aGlzXG5cblxuXHRyZWRyYXc6IC0+XG5cdFx0aWYgIUByZW5kZXJlZCB0aGVuIHJldHVyblxuXHRcdGlmIEBjb250ZW50RWwgdGhlbiBAY29udGVudEVsLmVtcHR5KCkgZWxzZSBAZWwuZW1wdHkoKVxuXHRcdEBkcmF3Q29tcG9uZW50KClcblx0XHRyZXR1cm4gdGhpc1xuXG5cblx0ZHJhd0NvbXBvbmVudDogLT5cblx0XHQjIG1hcmsgY29tcG9uZW50IGFzIFwiaW4gcmVuZGVyaW5nIHByb2NlY3NzXCJcblx0XHRAcmVuZGVyaW5nID0gdHJ1ZVxuXHRcdEBlbWl0KFwicmVuZGVyXCIsIHRoaXMsIEBlbClcblxuXHRcdCMgcmVuZGVyIGNvbXBvbmVudFxuXHRcdEBkb1JlbmRlcigpXG5cdFx0QGNhbGxQbHVnaW5zKCdkb1JlbmRlcicsIHRoaXMpXG5cblx0XHQjIG1hcCByZWZlcmVuY2VzXG5cdFx0QGdldEVsZW1lbnRzKFwiW21pd28tcmVmZXJlbmNlXVwiKS5lYWNoIChlbCkgPT5cblx0XHRcdHRoaXNbZWwuZ2V0QXR0cmlidXRlKFwibWl3by1yZWZlcmVuY2VcIildID0gZWxcblx0XHRcdGVsLnJlbW92ZUF0dHJpYnV0ZSBcIm1pd28tcmVmZXJlbmNlXCJcblx0XHRcdHJldHVyblxuXG5cdFx0IyBtYXJrIGNvbXBvbmVudCBhcyBcInJlbmRlcmVkXCJcblx0XHRAcmVuZGVyZWQgPSB0cnVlXG5cdFx0QHJlbmRlcmluZyA9IGZhbHNlXG5cblx0XHQjIGFmdGVyIHJlbmRlciBtb2RpZmljYXRpb25zLCBjb21wb25lbnQgaXMgcmVuZGVyZWQsIGJ5IGRlZmF1bHQgdGhpcyBtZXRob2QgaGFuZGxlIGV2ZW50cyBzZXR1cCBhbmQgb3RoZXIgZnVuY2lvbmFsaXR5XG5cdFx0QGNhbGxlZEFmdGVyUmVuZGVyID0gZmFsc2Vcblx0XHRAYWZ0ZXJSZW5kZXIoKVxuXHRcdGlmICFAY2FsbGVkQWZ0ZXJSZW5kZXIgdGhlbiB0aHJvdyBuZXcgRXJyb3IoXCJJbiBjb21wb25lbnQgI3tAfSB5b3UgZm9yZ290IGNhbGwgc3VwZXI6OmFmdGVyUmVuZGVyKClcIilcblx0XHRAY2FsbFBsdWdpbnMoJ2FmdGVyUmVuZGVyJywgdGhpcylcblxuXHRcdEB3YXNSZW5kZXJlZCA9IHRydWVcblxuXHRcdCMgbm90aWZ5IHJlbmRlcmVkXG5cdFx0QGVtaXQoXCJyZW5kZXJlZFwiLCAgdGhpcywgQGdldENvbnRlbnRFbCgpKVxuXHRcdHJldHVyblxuXG5cblx0YmVmb3JlUmVuZGVyOiAtPlxuXHRcdEBjYWxsZWRCZWZvcmVSZW5kZXIgPSB0cnVlXG5cblx0XHRlbCA9IEBlbFxuXHRcdGVsLnNldFZpc2libGUoQHZpc2libGUpXG5cblx0XHQjIHNldHVwIHByb3BlcnRpZXNcblx0XHRlbC5zZXQoXCJtaXdvLW5hbWVcIiwgQG5hbWUpXG5cdFx0ZWwuc3RvcmUoXCJjb21wb25lbnRcIiwgdGhpcylcblx0XHRlbC5zZXQoXCJpZFwiLCBAaWQpICBpZiAhQF9pc0dlbmVyYXRlZElkXG5cdFx0ZWwuc2V0KFwicm9sZVwiLCBAcm9sZSkgIGlmICFAcm9sZVxuXG5cdFx0IyBzZXR1cCBjbGFzc2VzXG5cdFx0ZWwuYWRkQ2xhc3MoQGNscykgIGlmIEBjbHNcblx0XHRlbC5hZGRDbGFzcyhAYmFzZUNscykgIGlmIEBiYXNlQ2xzXG5cdFx0ZWwuYWRkQ2xhc3MoQGNvbXBvbmVudENscykgIGlmIEBjb21wb25lbnRDbHNcblxuXHRcdCMgc2V0dXAgc3R5bGVzXG5cdFx0ZWwuc2V0U3R5bGVzKEBzdHlsZXMpICBpZiBAc3R5bGVzIGlzbnQgbnVsbFxuXHRcdGVsLnNldFN0eWxlKFwid2lkdGhcIiwgQHdpZHRoKSAgaWYgQHdpZHRoIGlzbnQgbnVsbFxuXHRcdGVsLnNldFN0eWxlKFwiaGVpZ2h0XCIsIEBoZWlnaHQpICBpZiBAaGVpZ2h0IGlzbnQgbnVsbFxuXHRcdGVsLnNldFN0eWxlKFwidG9wXCIsIEB0b3ApICBpZiBAdG9wIGlzbnQgbnVsbFxuXHRcdGVsLnNldFN0eWxlKFwiYm90dG9tXCIsIEBib3R0b20pICBpZiBAYm90dG9tIGlzbnQgbnVsbFxuXHRcdGVsLnNldFN0eWxlKFwibGVmdFwiLCBAbGVmdCkgIGlmIEBsZWZ0IGlzbnQgbnVsbFxuXHRcdGVsLnNldFN0eWxlKFwicmlnaHRcIiwgQHJpZ2h0KSAgaWYgQHJpZ2h0IGlzbnQgbnVsbFxuXHRcdGVsLnNldFN0eWxlKFwiekluZGV4XCIsIEB6SW5kZXgpICBpZiBAekluZGV4IGlzbnQgbnVsbFxuXHRcdGVsLnNldFN0eWxlKFwicGFkZGluZ1wiLCBAcGFkZGluZykgIGlmIEBwYWRkaW5nIGlzbnQgbnVsbFxuXHRcdGVsLnNldFN0eWxlKFwibWFyZ2luXCIsIEBtYXJnaW4pICBpZiBAbWFyZ2luIGlzbnQgbnVsbFxuXG5cdFx0IyBub3RpZnkgbWFuYWdlclxuXHRcdEBjb21wb25lbnRNZ3IuYmVmb3JlUmVuZGVyKHRoaXMpXG5cdFx0cmV0dXJuXG5cblxuXHRkb1JlbmRlcjogLT5cblx0XHRpZiBAdGVtcGxhdGVcblx0XHRcdEBnZXRUZW1wbGF0ZSgpLnJlbmRlcigpXG5cdFx0ZWxzZSBpZiBAaHRtbFxuXHRcdFx0QGdldENvbnRlbnRFbCgpLnNldChcImh0bWxcIiwgQGh0bWwpXG5cblx0XHQjIG1hcCByZWZlcmVuY2VzXG5cdFx0QGdldEVsZW1lbnRzKFwiW21pd28tcmVmZXJlbmNlXVwiKS5lYWNoIChlbCkgPT5cblx0XHRcdHRoaXNbZWwuZ2V0QXR0cmlidXRlKFwibWl3by1yZWZlcmVuY2VcIildID0gZWxcblx0XHRcdGVsLnJlbW92ZUF0dHJpYnV0ZSBcIm1pd28tcmVmZXJlbmNlXCJcblx0XHRcdHJldHVyblxuXHRcdHJldHVyblxuXG5cblx0YWZ0ZXJSZW5kZXI6IC0+XG5cdFx0QGNhbGxlZEFmdGVyUmVuZGVyID0gdHJ1ZVxuXG5cdFx0IyBzZXQgZXZlbnRzXG5cdFx0QGdldEVsZW1lbnRzKFwiW21pd28tZXZlbnRzXVwiKS5lYWNoIChlbCkgPT5cblx0XHRcdGV2ZW50cyA9IGVsLmdldEF0dHJpYnV0ZShcIm1pd28tZXZlbnRzXCIpLnNwbGl0KFwiLFwiKVxuXHRcdFx0Zm9yIGV2ZW50IGluIGV2ZW50c1xuXHRcdFx0XHRwYXJ0cyA9IGV2ZW50LnNwbGl0KFwiOlwiLCAyKVxuXHRcdFx0XHRpZiAhdGhpc1twYXJ0c1sxXV1cblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJbQ29tcG9uZW50OjphZnRlclJlbmRlcl0gSW4gY29tcG9uZW50ICN7QG5hbWV9IGlzIHVuZGVmaW5lZCBjYWxsYmFjayAnI3twYXJ0c1sxXX0nIGZvciBldmVudCAnI3twYXJ0c1swXX0nXCIpXG5cdFx0XHRcdGVsLm9uKHBhcnRzWzBdLCBAYm91bmQocGFydHNbMV0pKVxuXHRcdFx0ZWwucmVtb3ZlQXR0cmlidXRlKFwibWl3by1ldmVudHNcIilcblx0XHRcdHJldHVyblxuXG5cdFx0IyBub3RpZnkgbWFuYWdlclxuXHRcdEBjb21wb25lbnRNZ3IuYWZ0ZXJSZW5kZXIodGhpcylcblx0XHRyZXR1cm5cblxuXG5cdCNcblx0IyBWaXNpYmlsaXR5XG5cdCNcblxuXG5cdHNldFZpc2libGU6ICh2aXNpYmxlKSAtPlxuXHRcdGlmIHZpc2libGUgdGhlbiBAc2hvdygpIGVsc2UgQGhpZGUoKVxuXHRcdHJldHVyblxuXG5cblx0aXNWaXNpYmxlOiAtPlxuXHRcdHJldHVybiBAdmlzaWJsZVxuXG5cblx0c2V0UG9zaXRpb246IChwb3MpIC0+XG5cdFx0ZHNpemUgPSBkb2N1bWVudC5nZXRTaXplKClcblx0XHRzaXplID0gQGVsLmdldFNpemUoKVxuXHRcdHBvcy54ID0gTWF0aC5tYXgoMTAsIE1hdGgubWluKHBvcy54LCBkc2l6ZS54LXNpemUueC0xMCkpXG5cdFx0I3Bvcy55ID0gTWF0aC5tYXgoMTAsIE1hdGgubWluKHBvcy55LCBkc2l6ZS55LXNpemUueS0xMCkpXG5cdFx0QHRvcCA9IHBvcy55XG5cdFx0QGxlZnQgPSBwb3MueFxuXHRcdEBlbC5zZXRTdHlsZShcInRvcFwiLCBAdG9wKVxuXHRcdEBlbC5zZXRTdHlsZShcImxlZnRcIiwgQGxlZnQpXG5cdFx0cmV0dXJuXG5cblxuXHRzaG93OiAtPlxuXHRcdGlmICFAcmVuZGVyZWQgdGhlbiBAcmVuZGVyKClcblx0XHRpZiBAdmlzaWJsZSB0aGVuIHJldHVyblxuXHRcdEBlbWl0KFwic2hvd1wiLCB0aGlzKVxuXHRcdEBkb1Nob3coKVxuXHRcdEBwYXJlbnRTaG93bih0aGlzKVxuXHRcdEBlbWl0KFwic2hvd25cIiwgdGhpcylcblx0XHR0aGlzXG5cblxuXHRzaG93QXQ6IChwb3MpIC0+XG5cdFx0QHNob3coKSAjIG5lZWQgdG8gc2V0dXAgZWxlbWVudCBzaXplc1xuXHRcdEBzZXRQb3NpdGlvbihwb3MpXG5cdFx0cmV0dXJuXG5cblxuXHRkb1Nob3c6IC0+XG5cdFx0ZWwgPSBAZWxcblx0XHRlbC5zZXRTdHlsZShcInRvcFwiLCBAdG9wKSAgaWYgQHRvcCBpc250IG51bGxcblx0XHRlbC5zZXRTdHlsZShcImJvdHRvbVwiLCBAYm90dG9tKSAgaWYgQGJvdHRvbSBpc250IG51bGxcblx0XHRlbC5zZXRTdHlsZShcImxlZnRcIiwgQGxlZnQpICBpZiBAbGVmdCBpc250IG51bGxcblx0XHRlbC5zZXRTdHlsZShcInJpZ2h0XCIsIEByaWdodCkgIGlmIEByaWdodCBpc250IG51bGxcblx0XHRlbC5zaG93KClcblx0XHRAdmlzaWJsZSA9IHRydWVcblx0XHRpZiAoIUB0b3AgfHwgIUBsZWZ0KSBhbmQgQGF1dG9DZW50ZXIgdGhlbiBAY2VudGVyKClcblx0XHRyZXR1cm5cblxuXG5cdHBhcmVudFNob3duOiAocGFyZW50KSAtPlxuXHRcdEBlbWl0KFwicGFyZW50c2hvd25cIiwgcGFyZW50KVxuXHRcdHJldHVyblxuXG5cblx0aGlkZTogLT5cblx0XHRpZiAhQHZpc2libGUgdGhlbiByZXR1cm5cblx0XHRAZW1pdChcImhpZGVcIiwgdGhpcylcblx0XHRAZG9IaWRlKClcblx0XHRAZW1pdChcImhpZGVuXCIsIHRoaXMpXG5cdFx0dGhpc1xuXG5cblx0ZG9IaWRlOiAtPlxuXHRcdEB2aXNpYmxlID0gZmFsc2Vcblx0XHRAZWwuaGlkZSgpXG5cdFx0cmV0dXJuXG5cblxuXHRjZW50ZXI6IC0+XG5cdFx0aWYgIUBsZWZ0XG5cdFx0XHRAZWwuc2V0U3R5bGUoXCJsZWZ0XCIsIChAcGFyZW50RWwuZ2V0V2lkdGgoKSAtIEBlbC5nZXRXaWR0aCgpKSAvIDIpXG5cdFx0aWYgIUB0b3Bcblx0XHRcdEBlbC5zZXRTdHlsZShcInRvcFwiLCAoQHBhcmVudEVsLmdldEhlaWdodCgpIC0gQGVsLmdldEhlaWdodCgpKSAvIDIpXG5cdFx0cmV0dXJuXG5cblxuXHRzZXRTaXplOiAod2lkdGgsIGhlaWdodCkgLT5cblx0XHRpZiBUeXBlLmlzT2JqZWN0KHdpZHRoKVxuXHRcdFx0aGVpZ2h0ID0gd2lkdGguaGVpZ2h0XG5cdFx0XHR3aWR0aCA9IHdpZHRoLndpZHRoXG5cdFx0aWYgaGVpZ2h0IGlzbnQgdW5kZWZpbmVkIGFuZCBoZWlnaHQgaXNudCBudWxsXG5cdFx0XHRAaGVpZ2h0ID0gaGVpZ2h0XG5cdFx0XHRAZWwuc2V0U3R5bGUoXCJoZWlnaHRcIiwgaGVpZ2h0KVxuXHRcdGlmIHdpZHRoIGlzbnQgdW5kZWZpbmVkIGFuZCB3aWR0aCBpc250IG51bGxcblx0XHRcdEB3aWR0aCA9IHdpZHRoXG5cdFx0XHRAZWwuc2V0U3R5bGUoXCJ3aWR0aFwiLCB3aWR0aClcblx0XHRAZW1pdChcInJlc2l6ZVwiLCB0aGlzKVxuXHRcdHJldHVyblxuXG5cblx0Z2V0U2l6ZTogLT5cblx0XHRyZXR1cm5cblx0XHR3aWR0aDogQGVsLmdldFdpZHRoKClcblx0XHRoZWlnaHQ6IEBlbC5nZXRIZWlnaHQoKVxuXG5cblx0I1xuXHQjIERlc3Ryb3lpbmdcblx0I1xuXG5cblx0YmVmb3JlRGVzdHJveTogLT5cblx0XHRAZW1pdChcImRlc3Ryb3lcIiwgdGhpcylcblx0XHRAY29udGFpbmVyLnJlbW92ZUNvbXBvbmVudChAbmFtZSkgIGlmIEBjb250YWluZXJcblx0XHRtaXdvLnpJbmRleE1nci51bnJlZ2lzdGVyKHRoaXMpICBpZiBAekluZGV4TWFuYWdlXG5cdFx0bWl3by5jb21wb25lbnRNZ3IudW5yZWdpc3Rlcih0aGlzKVxuXHRcdHJldHVyblxuXG5cblx0ZG9EZXN0cm95OiAtPlxuXHRcdEB0ZW1wbGF0ZS5kZXN0cm95KCkgaWYgQHRlbXBsYXRlPy5kZXN0cm95P1xuXHRcdEBlbC5lbGltaW5hdGUoXCJjb21wb25lbnRcIilcblx0XHRAZWwuZGVzdHJveSgpXG5cdFx0Zm9yIG5hbWUscGx1Z2luIG9mIEBwbHVnaW5zIHRoZW4gQHVuaW5zdGFsbFBsdWdpbihuYW1lKVxuXHRcdHJldHVyblxuXG5cblx0YWZ0ZXJEZXN0cm95OiAtPlxuXHRcdEBlbWl0KFwiZGVzdHJveWVkXCIsIHRoaXMpXG5cdFx0cmV0dXJuXG5cblxuXG5tb2R1bGUuZXhwb3J0cyA9IENvbXBvbmVudCIsIk1pd29PYmplY3QgPSByZXF1aXJlKCcuLi9jb3JlL09iamVjdCcpXG5cblxuY2xhc3MgQ29tcG9uZW50TWFuYWdlciBleHRlbmRzIE1pd29PYmplY3RcblxuXHRsaXN0OiBudWxsXG5cdG5hbWVzOiBudWxsXG5cdHJvb3RzOiBudWxsXG5cdGlkOiAxXG5cblxuXHRjb25zdHJ1Y3RvcjogKCkgLT5cblx0XHRzdXBlcigpXG5cdFx0QGxpc3QgPSB7fVxuXHRcdEBuYW1lcyA9IHt9XG5cdFx0QHJvb3RzID0gW11cblx0XHRyZXR1cm5cblxuXG5cdHVuaXF1ZUlkOiAtPlxuXHRcdEBpZCsrXG5cdFx0cmV0dXJuIFwiY1wiICsgQGlkXG5cblxuXHR1bmlxdWVOYW1lOiAoZ3JvdXApIC0+XG5cdFx0QG5hbWVzW2dyb3VwXSA9IDAgIHVubGVzcyBAbmFtZXNbZ3JvdXBdXG5cdFx0QG5hbWVzW2dyb3VwXSsrXG5cdFx0cmV0dXJuIGdyb3VwICsgQG5hbWVzW2dyb3VwXVxuXG5cblx0cmVnaXN0ZXI6IChjbXApIC0+XG5cdFx0aWYgY21wLmNvbXBvbmVudE1nciB0aGVuIHRocm93IG5ldyBFcnJvcihcIkNvbXBvbmVudCAje2NvbXB9IHdpdGggaWQgI3tjbXAuaWR9IGFscmVhZHkgZXhpc3RzLlwiKVxuXHRcdGNtcC5jb21wb25lbnRNZ3IgPSB0aGlzXG5cdFx0QGxpc3RbY21wLmlkXSA9IGNtcFxuXHRcdEByb290cy5pbmNsdWRlKGNtcClcblx0XHRjbXAub24gJ2F0dGFjaGVkJywgKGNtcCkgPT5cblx0XHRcdEByb290cy5lcmFzZShjbXApXG5cdFx0XHRyZXR1cm5cblx0XHRjbXAub24gJ2RldGFjaGVkJywgKGNtcCkgPT5cblx0XHRcdEByb290cy5pbmNsdWRlKGNtcCkgaWYgIWNtcC5kZXN0cm95aW5nXG5cdFx0XHRyZXR1cm5cblx0XHRjbXAub24gJ2lkY2hhbmdlJywgKGNtcCwgbmV3SWQsIG9sZElkKSA9PlxuXHRcdFx0ZGVsZXRlIEBsaXN0W29sZElkXVxuXHRcdFx0QGxpc3RbbmV3SWRdID0gY21wXG5cdFx0XHRyZXR1cm5cblx0XHRAZW1pdChcInJlZ2lzdGVyXCIsIGNtcClcblx0XHRyZXR1cm5cblxuXG5cdHVucmVnaXN0ZXI6IChjbXApIC0+XG5cdFx0aWYgQHJvb3RzLmNvbnRhaW5zKGNtcClcblx0XHRcdEByb290cy5lcmFzZShjbXApXG5cdFx0aWYgQGxpc3RbY21wLmlkXVxuXHRcdFx0ZGVsZXRlIEBsaXN0W2NtcC5pZF1cblx0XHRcdGRlbGV0ZSBjbXAuY29tcG9uZW50TWdyXG5cdFx0XHRAZW1pdChcInVucmVnaXN0ZXJcIiwgY21wKVxuXHRcdHJldHVyblxuXG5cblx0YmVmb3JlUmVuZGVyOiAoY21wKSAtPlxuXHRcdEBlbWl0KFwiYmVmb3JlcmVuZGVyXCIsIGNtcClcblx0XHRyZXR1cm5cblxuXG5cdGFmdGVyUmVuZGVyOiAoY21wKSAtPlxuXHRcdEBlbWl0KFwiYWZ0ZXJyZW5kZXJcIiwgY21wKVxuXHRcdHJldHVyblxuXG5cblx0Z2V0OiAoaWQpIC0+XG5cdFx0cmV0dXJuIChpZiBAbGlzdFtpZF0gdGhlbiBAbGlzdFtpZF0gZWxzZSBudWxsKVxuXG5cblxubW9kdWxlLmV4cG9ydHMgPSBDb21wb25lbnRNYW5hZ2VyIiwiY2xhc3MgQ29tcG9uZW50U2VsZWN0b3JcblxuXHRzZWxlY3Rvck1hdGNoOiAvXihbXFwjXFwuXSk/KFteXFxbXSopKC4qKSQvXG5cdGF0dHJpYnV0ZXNNYXRjaDogL1xcWyhbXlxcXV0rKVxcXS9nXG5cdGF0dHJpYnV0ZU1hdGNoOiAvXlxcWyhbXj1cXF1dKykoPShbXlxcXV0qKSk/XFxdJC9cblxuXHRpczogKGNvbXBvbmVudCwgc2VsZWN0b3IpIC0+XG5cdFx0aWYgc2VsZWN0b3IgaXMgJyonXG5cdFx0XHRyZXR1cm4gdHJ1ZVxuXG5cdFx0aWYgIShtYXRjaGVzID0gc2VsZWN0b3IubWF0Y2goQHNlbGVjdG9yTWF0Y2gpKVxuXHRcdFx0cmV0dXJuIGZhbHNlXG5cblx0XHRpZiBtYXRjaGVzWzJdXG5cdFx0XHRpZiBtYXRjaGVzWzFdIGlzICcjJ1xuXHRcdFx0XHRpZiBtYXRjaGVzWzJdIGlzbnQgY29tcG9uZW50LmlkIHRoZW4gcmV0dXJuIGZhbHNlXG5cdFx0XHRlbHNlIGlmIG1hdGNoZXNbMV0gaXMgJy4nXG5cdFx0XHRcdGlmIG1hdGNoZXNbMl0gaXNudCBjb21wb25lbnQubmFtZSB0aGVuIHJldHVybiBmYWxzZVxuXHRcdFx0ZWxzZVxuXHRcdFx0XHRpZiAhY29tcG9uZW50LmlzWHR5cGUobWF0Y2hlc1syXSkgdGhlbiByZXR1cm4gZmFsc2VcblxuXHRcdGlmIG1hdGNoZXNbM11cblx0XHRcdGZvciBtYXRjaCBpbiBtYXRjaGVzWzNdLm1hdGNoKEBhdHRyaWJ1dGVzTWF0Y2gpXG5cdFx0XHRcdGlmICEoYXR0ck1hdGNoZXMgPSBtYXRjaC5tYXRjaChAYXR0cmlidXRlTWF0Y2gpKVxuXHRcdFx0XHRcdHJldHVybiBmYWxzZVxuXG5cdFx0XHRcdGlmIGF0dHJNYXRjaGVzWzNdIGlzIHVuZGVmaW5lZFxuXHRcdFx0XHRcdGlmICFjb21wb25lbnRbYXR0ck1hdGNoZXNbMV1dIHRoZW4gcmV0dXJuIGZhbHNlXG5cdFx0XHRcdGVsc2Vcblx0XHRcdFx0XHRpZiBhdHRyTWF0Y2hlc1szXS5tYXRjaCgvXlxcZCskLylcblx0XHRcdFx0XHRcdGF0dHJNYXRjaGVzWzNdID0gcGFyc2VJbnQoYXR0ck1hdGNoZXNbM10sIDEwKVxuXHRcdFx0XHRcdGVsc2UgaWYgYXR0ck1hdGNoZXNbM10ubWF0Y2goL15cXGQrXFwuXFxkKyQvKVxuXHRcdFx0XHRcdFx0YXR0ck1hdGNoZXNbM10gPSBwYXJzZUZsb2F0KGF0dHJNYXRjaGVzWzNdKVxuXG5cdFx0XHRcdFx0aWYgY29tcG9uZW50W2F0dHJNYXRjaGVzWzFdXSBpc250IGF0dHJNYXRjaGVzWzNdIHRoZW4gcmV0dXJuIGZhbHNlXG5cdFx0cmV0dXJuIHRydWVcblxuXG5cdHF1ZXJ5UGFyZW50OiAoY29tcG9uZW50LCBzZWxlY3RvcikgLT5cblx0XHRjb21wb25lbnQgPSBjb21wb25lbnQuZ2V0UGFyZW50KClcblx0XHR3aGlsZSBjb21wb25lbnRcblx0XHRcdGlmIGNvbXBvbmVudC5pcyhzZWxlY3RvcikgdGhlbiBicmVha1xuXHRcdFx0Y29tcG9uZW50ID0gY29tcG9uZW50LmdldFBhcmVudCgpXG5cdFx0cmV0dXJuIGNvbXBvbmVudFxuXG5cblx0cXVlcnk6IChzZWxlY3RvciwgY29udGFpbmVyKSAtPlxuXHRcdGlmIHNlbGVjdG9yIGlzICc+JyB8fCBzZWxlY3RvciBpcyAnKidcblx0XHRcdHJldHVybiBjb250YWluZXIuY2hpbGQoKVxuXG5cdFx0c2NvcGUgPSBjb250YWluZXJcblx0XHRwYXJ0cyA9IHNlbGVjdG9yLnNwbGl0KCcgJylcblx0XHRmb3Igc2VsZWN0b3IgaW4gcGFydHNcblx0XHRcdGlmIHNlbGVjdG9yIGlzICc+J1xuXHRcdFx0XHRuZXN0ZWQgPSB0cnVlXG5cdFx0XHRcdGNvbnRpbnVlXG5cblx0XHRcdGlmICFzY29wZS5pc0NvbnRhaW5lclxuXHRcdFx0XHRyZXR1cm4gbnVsbFxuXG5cdFx0XHRjb21wb25lbnRzID0gc2NvcGUuY29tcG9uZW50cy50b0FycmF5KClcblx0XHRcdHNjb3BlID0gbnVsbCAjIHJlc2V0IHNjb3BlIChuZWVkIGZpbmQgaXQpXG5cdFx0XHR3aGlsZSBjb21wb25lbnQgPSBjb21wb25lbnRzLnNoaWZ0KClcblx0XHRcdFx0aWYgY29tcG9uZW50LmlzKHNlbGVjdG9yKVxuXHRcdFx0XHRcdHNjb3BlID0gY29tcG9uZW50XG5cdFx0XHRcdFx0YnJlYWtcblx0XHRcdFx0ZWxzZSBpZiBjb21wb25lbnQuaXNDb250YWluZXIgJiYgIW5lc3RlZFxuXHRcdFx0XHRcdGNvbXBvbmVudHMuYXBwZW5kKGNvbXBvbmVudC5jb21wb25lbnRzLnRvQXJyYXkoKSlcblxuXHRcdFx0aWYgIXNjb3BlXG5cdFx0XHRcdHJldHVybiBudWxsXG5cblx0XHRcdG5lc3RlZCA9IGZhbHNlXG5cblx0XHRyZXR1cm4gaWYgc2NvcGUgaXNudCBjb250YWluZXIgdGhlbiBzY29wZSBlbHNlIG51bGxcblxuXG5cdHF1ZXJ5QWxsOiAoc2VsZWN0b3IsIGNvbnRhaW5lcikgLT5cblx0XHRwcmV2aW91c1Jvb3RzID0gW2NvbnRhaW5lcl1cblx0XHRjb21wb25lbnRzID0gY29udGFpbmVyLmNvbXBvbmVudHMudG9BcnJheSgpXG5cblx0XHRmb3Igc2VsZWN0b3IgaW4gc2VsZWN0b3Iuc3BsaXQoJyAnKVxuXHRcdFx0aWYgc2VsZWN0b3IgaXMgJz4nXG5cdFx0XHRcdG5lc3RlZCA9IHRydWVcblx0XHRcdFx0Y29udGludWVcblxuXHRcdFx0aWYgY29tcG9uZW50cy5sZW5ndGggaXMgMFxuXHRcdFx0XHRyZXR1cm4gW11cblxuXHRcdFx0c2VsZWN0b3JzID0gc2VsZWN0b3Iuc3BsaXQoJywnKVxuXG5cdFx0XHRuZXN0ZWRSb290cyA9IFtdXG5cdFx0XHRmb3IgY29tcG9uZW50IGluIGNvbXBvbmVudHNcblx0XHRcdFx0bmVzdGVkUm9vdHMucHVzaChjb21wb25lbnQpXG5cblx0XHRcdG1hdGNoZWQgPSBbXVxuXHRcdFx0d2hpbGUgY29tcG9uZW50ID0gY29tcG9uZW50cy5zaGlmdCgpXG5cdFx0XHRcdGZvciBzZWwgaW4gc2VsZWN0b3JzXG5cdFx0XHRcdFx0aWYgY29tcG9uZW50LmlzKHNlbCkgJiYgcHJldmlvdXNSb290cy5pbmRleE9mKGNvbXBvbmVudCkgPCAwXG5cdFx0XHRcdFx0XHRtYXRjaGVkLnB1c2goY29tcG9uZW50KVxuXHRcdFx0XHRpZiBjb21wb25lbnQuaXNDb250YWluZXIgJiYgKCFuZXN0ZWQgfHwgbmVzdGVkUm9vdHMuaW5kZXhPZihjb21wb25lbnQpID49IDApXG5cdFx0XHRcdFx0Y29tcG9uZW50cy5hcHBlbmQoY29tcG9uZW50LmNvbXBvbmVudHMudG9BcnJheSgpKVxuXG5cdFx0XHRjb21wb25lbnRzID0gbWF0Y2hlZFxuXG5cdFx0XHRwcmV2aW91c1Jvb3RzID0gW11cblx0XHRcdGZvciBjb21wb25lbnQgaW4gY29tcG9uZW50c1xuXHRcdFx0XHRwcmV2aW91c1Jvb3RzLnB1c2goY29tcG9uZW50KVxuXG5cdFx0XHRuZXN0ZWQgPSBmYWxzZVxuXG5cdFx0cmV0dXJuIGNvbXBvbmVudHNcblxuXG5tb2R1bGUuZXhwb3J0cyA9IENvbXBvbmVudFNlbGVjdG9yIiwibGF5b3V0ID0gcmVxdWlyZSAnLi4vbGF5b3V0J1xuQ29tcG9uZW50ID0gcmVxdWlyZSAnLi9Db21wb25lbnQnXG5Db2xsZWN0aW9uID0gcmVxdWlyZSAnLi4vdXRpbHMvQ29sbGVjdGlvbidcblxuXG5jbGFzcyBDb250YWluZXIgZXh0ZW5kcyBDb21wb25lbnRcblxuXHRpc0NvbnRhaW5lcjogdHJ1ZVxuXG5cdHh0eXBlOiAnY29udGFpbmVyJ1xuXG5cdCMgQGNvbmZpZyB7U3RyaW5nfSBsYXlvdXQgIFVzZSBsYXlvdXQgZm9yIHJlbmRlciBjaGlsZCBjb21wb25lbnRzXG5cdGxheW91dDogJ2F1dG8nXG5cblx0Y29tcG9uZW50czogbnVsbFxuXG5cblxuXHRkb0luaXQ6IC0+XG5cdFx0c3VwZXIoKVxuXHRcdEBjb21wb25lbnRzID0gbmV3IENvbGxlY3Rpb24oKVxuXHRcdHJldHVyblxuXG5cblxuXHQjIENvbXBvbmVudCBNb2RlbFxuXG5cblx0IyBBZGQgY29tcG9uZW50IHRvIHRoaXMgY29udGFpbmVyXG5cdCMgQHBhcmFtIHtTdHJpbmd9IG5hbWVcblx0IyBAcGFyYW0ge01pd28uY29tcG9uZW50LkNvbXBvbmVudH0gY29tcG9uZW50XG5cdCMgQHJldHVybnMge01pd28uY29tcG9uZW50LkNvbXBvbmVudH1cblx0YWRkQ29tcG9uZW50OiAobmFtZSwgY29tcG9uZW50KSAtPlxuXHRcdGlmICFUeXBlLmlzU3RyaW5nKG5hbWUpXG5cdFx0XHRjb21wb25lbnQgPSBuYW1lXG5cdFx0XHRuYW1lID0gY29tcG9uZW50Lm5hbWVcblxuXHRcdGlmIG5vdCBuYW1lIG9yIG5vdCBuYW1lLnRlc3QoL15bYS16QS1aMC05XSskLylcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkNvbXBvbmVudCBuYW1lIG11c3QgYmUgbm9uLWVtcHR5IGFscGhhbnVtZXJpYyBzdHJpbmcsICdcIiArIG5hbWUgKyBcIicgZ2l2ZW4uXCIpXG5cblx0XHRpZiBAY29tcG9uZW50cy5oYXMobmFtZSlcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkNvbXBvbmVudCB3aXRoIG5hbWUgJ1wiICsgbmFtZSArIFwiJyBhbHJlYWR5IGV4aXN0cy5cIilcblxuXHRcdCMgY2hlY2sgY2lyY3VsYXIgcmVmZXJlbmNlXG5cdFx0b2JqID0gdGhpc1xuXHRcdGxvb3Bcblx0XHRcdGlmIG9iaiBpcyBjb21wb25lbnRcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiQ2lyY3VsYXIgcmVmZXJlbmNlIGRldGVjdGVkIHdoaWxlIGFkZGluZyBjb21wb25lbnQgJ1wiICsgbmFtZSArIFwiJy5cIilcblx0XHRcdG9iaiA9IG9iai5nZXRQYXJlbnQoKVxuXHRcdFx0YnJlYWsgaWYgb2JqIGlzIG51bGxcblxuXHRcdCMgdXNlciBjaGVja2luZ1xuXHRcdEB2YWxpZGF0ZUNoaWxkQ29tcG9uZW50KGNvbXBvbmVudClcblx0XHRAZW1pdChcImFkZFwiLCB0aGlzLCBjb21wb25lbnQpXG5cblx0XHR0cnlcblx0XHRcdEBjb21wb25lbnRzLnNldChuYW1lLCBjb21wb25lbnQpXG5cdFx0XHRjb21wb25lbnQuc2V0UGFyZW50KHRoaXMsIG5hbWUpXG5cdFx0Y2F0Y2ggZXJyb3Jcblx0XHRcdEBjb21wb25lbnRzLnJlbW92ZShuYW1lKVxuXHRcdFx0Y29uc29sZS5sb2coZXJyb3IsIGVycm9yLnN0YWNrKVxuXHRcdFx0dGhyb3cgZXJyb3JcblxuXHRcdEBhZGRlZENvbXBvbmVudChjb21wb25lbnQpXG5cdFx0QGFkZGVkQ29tcG9uZW50RGVlcChjb21wb25lbnQpXG5cdFx0QGVtaXQoXCJhZGRlZFwiLCB0aGlzLCBjb21wb25lbnQpXG5cdFx0QHJlbmRlckNvbXBvbmVudChjb21wb25lbnQpIGlmIEByZW5kZXJlZFxuXHRcdHJldHVybiBjb21wb25lbnRcblxuXG5cdGFkZGVkQ29tcG9uZW50OiAoY29tcG9uZW50KSAtPlxuXHRcdHJldHVyblxuXG5cblx0IyBwcm9wYWdhdGUgdG8gcGFyZW50XG5cdGFkZGVkQ29tcG9uZW50RGVlcDogKGNvbXBvbmVudCkgLT5cblx0XHRAY29udGFpbmVyLmFkZGVkQ29tcG9uZW50RGVlcChjb21wb25lbnQpICBpZiBAY29udGFpbmVyXG5cdFx0cmV0dXJuXG5cblxuXHRyZW1vdmVDb21wb25lbnQ6IChuYW1lKSAtPlxuXHRcdGlmICFAY29tcG9uZW50cy5oYXMobmFtZSlcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkNvbXBvbmVudCBuYW1lZCAnXCIgKyBuYW1lICsgXCInIGlzIG5vdCBsb2NhdGVkIGluIHRoaXMgY29udGFpbmVyLlwiKVxuXG5cdFx0Y29tcG9uZW50ID0gQGNvbXBvbmVudHMuZ2V0KG5hbWUpXG5cdFx0QGVtaXQoXCJyZW1vdmVcIiwgdGhpcywgY29tcG9uZW50KVxuXHRcdGNvbXBvbmVudC5zZXRQYXJlbnQobnVsbClcblx0XHRAY29tcG9uZW50cy5yZW1vdmUobmFtZSlcblx0XHRAcmVtb3ZlZENvbXBvbmVudChjb21wb25lbnQpXG5cdFx0QHJlbW92ZWRDb21wb25lbnREZWVwKGNvbXBvbmVudClcblx0XHRAZW1pdChcInJlbW92ZWRcIiwgdGhpcywgY29tcG9uZW50KVxuXHRcdHJldHVyblxuXG5cblx0cmVtb3ZlQ29tcG9uZW50czogLT5cblx0XHRAY29tcG9uZW50cy5lYWNoIChjb21wb25lbnQsIG5hbWUpID0+XG5cdFx0XHRAcmVtb3ZlQ29tcG9uZW50KG5hbWUpXG5cdFx0XHRjb21wb25lbnQuZGVzdHJveSgpXG5cdFx0XHRyZXR1cm5cblx0XHRyZXR1cm5cblxuXG5cdHJlbW92ZWRDb21wb25lbnQ6IChjb21wb25lbnQpIC0+XG5cdFx0cmV0dXJuXG5cblxuXHQjIHByb3BhZ2F0ZSB0byBwYXJlbnRcblx0cmVtb3ZlZENvbXBvbmVudERlZXA6IChjb21wb25lbnQpIC0+XG5cdFx0cGFyZW50ID0gQGdldFBhcmVudCgpXG5cdFx0cGFyZW50LnJlbW92ZWRDb21wb25lbnREZWVwKGNvbXBvbmVudCkgIGlmIHBhcmVudFxuXHRcdHJldHVyblxuXG5cblx0IyBHZXQgY29tcG9uZW50IGJ5IG5hbWVcblx0IyBAcGFyYW0ge1N0cmluZ30gbmFtZVxuXHQjIEBwYXJhbSB7Qm9vbGVhbn0gbmVlZFxuXHQjIEByZXR1cm5zIHtNaXdvLmNvbXBvbmVudC5Db21wb25lbnR9XG5cdGdldENvbXBvbmVudDogKG5hbWUsIG5lZWQgPSB0cnVlKSAtPlxuXHRcdGlmICFuYW1lXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJDb21wb25lbnQgb3Igc3ViY29tcG9uZW50IG5hbWUgbXVzdCBub3QgYmUgZW1wdHkgc3RyaW5nLlwiKVxuXG5cdFx0ZXh0ID0gbnVsbFxuXHRcdHBvcyA9IG5hbWUuaW5kZXhPZihcIi1cIilcblx0XHRpZiBwb3MgPiAwXG5cdFx0XHRleHQgPSBuYW1lLnN1YnN0cmluZyhwb3MgKyAxKVxuXHRcdFx0bmFtZSA9IG5hbWUuc3Vic3RyaW5nKDAsIHBvcylcblxuXHRcdGlmIG5hbWUgaXMgXCJwYXJlbnRcIlxuXHRcdFx0cmV0dXJuIGlmICFleHQgdGhlbiBAY29tcG9uZW50IGVsc2UgQGNvbXBvbmVudC5nZXRDb21wb25lbnQoZXh0LCBuZWVkKVxuXG5cdFx0aWYgIUBjb21wb25lbnRzLmhhcyhuYW1lKVxuXHRcdFx0Y29tcG9uZW50ID0gQGNyZWF0ZUNvbXBvbmVudChuYW1lKVxuXHRcdFx0aWYgY29tcG9uZW50ICYmIGNvbXBvbmVudC5nZXRQYXJlbnQoKSBpcyBudWxsXG5cdFx0XHRcdEBhZGRDb21wb25lbnQobmFtZSwgY29tcG9uZW50KVxuXG5cdFx0aWYgQGNvbXBvbmVudHMuaGFzKG5hbWUpXG5cdFx0XHRpZiAhZXh0XG5cdFx0XHRcdHJldHVybiBAY29tcG9uZW50cy5nZXQobmFtZSlcblx0XHRcdGVsc2Vcblx0XHRcdFx0cmV0dXJuIEBjb21wb25lbnRzLmdldChuYW1lKS5nZXRDb21wb25lbnQoZXh0LCBuZWVkKVxuXHRcdGVsc2UgaWYgbmVlZFxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiQ29tcG9uZW50IHdpdGggbmFtZSAnXCIgKyBuYW1lICsgXCInIGRvZXMgbm90IGV4aXN0LlwiKVxuXHRcdHJldHVyblxuXG5cblx0Y3JlYXRlQ29tcG9uZW50OiAobmFtZSkgLT5cblx0XHRtZXRob2QgPSAnY3JlYXRlQ29tcG9uZW50JytuYW1lLmNhcGl0YWxpemUoKVxuXHRcdGlmIHRoaXNbbWV0aG9kXVxuXHRcdFx0Y29tcG9uZW50ID0gdGhpc1ttZXRob2RdKG5hbWUpXG5cdFx0XHRpZiAhY29tcG9uZW50ICYmICFAY29tcG9uZW50cy5oYXMobmFtZSlcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiTWV0aG9kICN7dGhpc306OiN7bWV0aG9kfSgpIGRpZCBub3QgcmV0dXJuIG9yIGNyZWF0ZSB0aGUgZGVzaXJlZCBjb21wb25lbnQuXCIpXG5cdFx0XHRyZXR1cm4gY29tcG9uZW50XG5cdFx0cmV0dXJuIG51bGxcblxuXG5cdGhhc0NvbXBvbmVudHM6IC0+XG5cdFx0cmV0dXJuIEBjb21wb25lbnRzLmxlbmd0aCA+IDBcblxuXG5cdGdldENvbXBvbmVudHM6IChhc0FycmF5KSAtPlxuXHRcdHJldHVybiBpZiBhc0FycmF5IHRoZW4gQGNvbXBvbmVudHMudG9BcnJheSgpIGVsc2UgQGNvbXBvbmVudHNcblxuXG5cdGZpbmRDb21wb25lbnRzOiAoZGVlcCA9IGZhbHNlLCBmaWx0ZXJzID0ge30sIGNvbXBvbmVudHMgPSBbXSkgLT5cblx0XHRAY29tcG9uZW50cy5lYWNoIChjb21wb25lbnQpIC0+XG5cdFx0XHRtYXRjaGVkID0gZmFsc2Vcblx0XHRcdGZvciBuYW1lLHZhbHVlIG9mIGZpbHRlcnNcblx0XHRcdFx0ZmlsdGVyZWQgPSB0cnVlXG5cdFx0XHRcdGlmIGNvbXBvbmVudFtuYW1lXSBpcyB2YWx1ZVxuXHRcdFx0XHRcdG1hdGNoZWQgPSB0cnVlXG5cdFx0XHRcdFx0YnJlYWtcblxuXHRcdFx0aWYgIWZpbHRlcmVkIHx8IG1hdGNoZWRcblx0XHRcdFx0bWF0Y2hlZCA9IHRydWVcblx0XHRcdFx0Y29tcG9uZW50cy5wdXNoKGNvbXBvbmVudClcblxuXHRcdFx0aWYgY29tcG9uZW50LmlzQ29udGFpbmVyICYmIGRlZXBcblx0XHRcdFx0Y29tcG9uZW50LmZpbmRDb21wb25lbnRzKGRlZXAsIGZpbHRlcnMsIGNvbXBvbmVudHMpXG5cdFx0XHRyZXR1cm5cblx0XHRyZXR1cm4gY29tcG9uZW50c1xuXG5cblx0ZmluZENvbXBvbmVudDogKGRlZXAgPSBmYWxzZSwgZmlsdGVycyA9IHt9KSAtPlxuXHRcdGNvbXBvbmVudHMgPSBAZmluZENvbXBvbmVudHMoZGVlcCwgZmlsdGVycylcblx0XHRyZXR1cm4gaWYgY29tcG9uZW50cy5sZW5ndGggPiAwIHRoZW4gY29tcG9uZW50c1swXSBlbHNlIG51bGxcblxuXG5cdHZhbGlkYXRlQ2hpbGRDb21wb25lbnQ6IChjaGlsZCkgLT5cblx0XHRyZXR1cm5cblxuXG5cblx0IyBUcmF2ZXJzaW5nXG5cblxuXHRmaXJzdENoaWxkOiAtPlxuXHRcdHJldHVybiBAY29tcG9uZW50cy5nZXRGaXJzdCgpXG5cblxuXHRsYXN0Q2hpbGQ6IC0+XG5cdFx0cmV0dXJuIEBjb21wb25lbnRzLmdldExhc3QoKVxuXG5cblx0bmV4dFNpYmxpbmdPZjogKGNvbXBvbmVudCkgLT5cblx0XHRpbmRleCA9IEBjb21wb25lbnRzLmluZGV4T2YoY29tcG9uZW50KVxuXHRcdHJldHVybiAoaWYgaW5kZXggKyAxIDwgQGNvbXBvbmVudHMubGVuZ3RoIHRoZW4gQGNvbXBvbmVudHMuZ2V0QXQoaW5kZXggKyAxKSBlbHNlIG51bGwpXG5cblxuXHRwcmV2aW91c1NpYmxpbmdPZjogKGNvbXBvbmVudCkgLT5cblx0XHRpbmRleCA9IEBjb21wb25lbnRzLmluZGV4T2YoY29tcG9uZW50KVxuXHRcdHJldHVybiAoaWYgaW5kZXggPiAwIHRoZW4gQGNvbXBvbmVudHMuZ2V0QXQoaW5kZXggLSAxKSBlbHNlIG51bGwpXG5cblxuXHRmaW5kOiAoc2VsZWN0b3IgPSBcIipcIikgLT5cblx0XHRyZXR1cm4gbWl3by5jb21wb25lbnRTZWxlY3Rvci5xdWVyeShzZWxlY3RvciwgdGhpcylcblxuXG5cdGZpbmRBbGw6IChzZWxlY3RvciA9IFwiKlwiKSAtPlxuXHRcdHJldHVybiBtaXdvLmNvbXBvbmVudFNlbGVjdG9yLnF1ZXJ5QWxsKHNlbGVjdG9yLCB0aGlzKVxuXG5cblx0Y2hpbGQ6IChzZWxlY3RvciA9IFwiKlwiKSAtPlxuXHRcdG1hdGNoZWQgPSBudWxsXG5cdFx0QGNvbXBvbmVudHMuZWFjaCAoY29tcG9uZW50KT0+XG5cdFx0XHRpZiAhbWF0Y2hlZCAmJiBjb21wb25lbnQuaXMoc2VsZWN0b3IpXG5cdFx0XHRcdG1hdGNoZWQgPSBjb21wb25lbnRcblx0XHRcdHJldHVyblxuXHRcdHJldHVybiBtYXRjaGVkXG5cblxuXHRnZXQ6IChuYW1lLCBuZWVkID0gZmFsc2UpIC0+XG5cdFx0cmV0dXJuIEBnZXRDb21wb25lbnQobmFtZSwgbmVlZClcblxuXG5cdGFkZDogKG5hbWUsIGNvbXBvbmVudCkgLT5cblx0XHRyZXR1cm4gQGFkZENvbXBvbmVudChuYW1lLCBjb21wb25lbnQpXG5cblxuXHRyZW1vdmU6IChuYW1lKSAtPlxuXHRcdHJldHVybiBAcmVtb3ZlQ29tcG9uZW50KG5hbWUpXG5cblxuXG5cdCMgVXRpbHNcblxuXG5cdHNldEZvY3VzOiAtPlxuXHRcdHN1cGVyKClcblx0XHRAZm9jdXNlZFBhcmVudCh0aGlzKVxuXHRcdHJldHVyblxuXG5cblx0Zm9jdXNlZFBhcmVudDogKHBhcmVudCkgLT5cblx0XHRAY29tcG9uZW50cy5lYWNoIChjb21wb25lbnQpIC0+XG5cdFx0XHRpZiBjb21wb25lbnQuYXV0b0ZvY3VzXG5cdFx0XHRcdGNvbXBvbmVudC5zZXRGb2N1cygpXG5cdFx0XHRlbHNlIGlmIGNvbXBvbmVudC5pc0NvbnRhaW5lclxuXHRcdFx0XHRjb21wb25lbnQuZm9jdXNlZFBhcmVudChwYXJlbnQpXG5cdFx0XHRyZXR1cm5cblx0XHRyZXR1cm5cblxuXG5cblx0IyBSZW5kZXJpbmdcblxuXG5cdHVwZGF0ZTogLT5cblx0XHRpZiBAbGF5b3V0ICYmIEBsYXlvdXQgaW5zdGFuY2VvZiBsYXlvdXQuTGF5b3V0XG5cdFx0XHRAbGF5b3V0LnVwZGF0ZSgpXG5cdFx0cmV0dXJuXG5cblxuXHRoYXNMYXlvdXQ6IC0+XG5cdFx0cmV0dXJuIEBsYXlvdXQgaXNudCBudWxsICYmIEBsYXlvdXQgaXNudCBmYWxzZVxuXG5cblx0c2V0TGF5b3V0OiAob2JqZWN0ID0gbnVsbCkgLT5cblx0XHRpZiBAbGF5b3V0ICYmIEBsYXlvdXQgaW5zdGFuY2VvZiBsYXlvdXQuTGF5b3V0ICYmICFvYmplY3Rcblx0XHRcdEBsYXlvdXQuc2V0Q29udGFpbmVyKG51bGwpXG5cdFx0XHRAbGF5b3V0ID0gbnVsbFxuXHRcdGlmIG9iamVjdFxuXHRcdFx0QGxheW91dCA9IG9iamVjdFxuXHRcdFx0QGxheW91dC5zZXRDb250YWluZXIodGhpcylcblx0XHRcdEBsYXlvdXQuaW5pdExheW91dCgpXG5cdFx0cmV0dXJuXG5cblxuXHRnZXRMYXlvdXQ6IC0+XG5cdFx0aWYgVHlwZS5pc1N0cmluZyhAbGF5b3V0KVxuXHRcdFx0QHNldExheW91dChsYXlvdXQuY3JlYXRlTGF5b3V0KEBsYXlvdXQpKVxuXHRcdHJldHVybiBAbGF5b3V0XG5cblxuXHRyZXNldFJlbmRlcmVkOiAoZGlzcG9zZSkgLT5cblx0XHRzdXBlclxuXHRcdEBjb21wb25lbnRzLmVhY2ggKGNvbXBvbmVudCktPiBjb21wb25lbnQucmVzZXRSZW5kZXJlZChkaXNwb3NlKVxuXHRcdHJldHVyblxuXG5cblx0ZG9SZW5kZXI6IC0+XG5cdFx0c3VwZXJcblx0XHQjIGN1c3RvbSBjb250YWluZXIgcmVuZGVyaW5nXG5cdFx0QHJlbmRlckNvbnRhaW5lcigpXG5cblx0XHQjIHJlbmRlciBjb21wb25lbnRzIChpZiBub3QgcmVuZGVyZWQgYnkgcmVuZGVyQ29udGFpbmVyKVxuXHRcdEBjb21wb25lbnRzLmVhY2ggKGNvbXBvbmVudCk9PlxuXHRcdFx0QHJlbmRlckNvbXBvbmVudChjb21wb25lbnQpICBpZiAhY29tcG9uZW50LnJlbmRlcmVkXG5cblx0XHQjIHJlbmRlciBjb21wb25lbnQgYnkgbGF5b3V0IChpZiBub3QgcmVuZGVyZWQgaW4gcmVuZGVyQ29tcG9uZW50KVxuXHRcdGlmIEBsYXlvdXRcblx0XHRcdEBnZXRMYXlvdXQoKS5yZW5kZXIoKVxuXHRcdHJldHVyblxuXG5cblx0cmVuZGVyQ29udGFpbmVyOiAtPlxuXHRcdCMgZmluZCBuZXN0ZWQgY2hpbGQgY29tcG9uZW50c1xuXHRcdHRvcENvbXBvbmVudEVscyA9IFtdXG5cdFx0Zm9yIGVsIGluIEBnZXRFbGVtZW50cyhcIlttaXdvLWNvbXBvbmVudF1cIilcblx0XHRcdHNraXBFbGVtZW50ID0gZmFsc2Vcblx0XHRcdGlmIHRvcENvbXBvbmVudEVscy5jb250YWlucyhlbClcblx0XHRcdFx0c2tpcEVsZW1lbnQgPSB0cnVlXG5cdFx0XHRlbHNlXG5cdFx0XHRcdGZvciBwYXJlbnQgaW4gZWwuZ2V0UGFyZW50cygnW21pd28tY29tcG9uZW50XScpXG5cdFx0XHRcdFx0aWYgdG9wQ29tcG9uZW50RWxzLmNvbnRhaW5zKHBhcmVudClcblx0XHRcdFx0XHRcdHNraXBFbGVtZW50ID0gdHJ1ZVxuXHRcdFx0XHRcdFx0Y29udGludWVcblx0XHRcdGlmICFza2lwRWxlbWVudFxuXHRcdFx0XHR0b3BDb21wb25lbnRFbHMucHVzaChlbClcblxuXHRcdCMgcmVwbGFjZSBjb21wb25lbnQncyBlbCB3aXRoIGZpbmRlZCBlbFxuXHRcdGZvciBlbCBpbiB0b3BDb21wb25lbnRFbHNcblx0XHRcdGNvbXBvbmVudCA9IEBnZXQoZWwuZ2V0QXR0cmlidXRlKFwibWl3by1jb21wb25lbnRcIiksIHRydWUpXG5cdFx0XHRjb21wb25lbnQucmVwbGFjZShlbClcblx0XHRyZXR1cm5cblxuXG5cdHJlbmRlckNvbXBvbmVudDogKGNvbXBvbmVudCkgLT5cblx0XHRpZiAhY29tcG9uZW50LnByZXZlbnRBdXRvUmVuZGVyXG5cdFx0XHRjb21wb25lbnQucmVuZGVyKEBnZXRDb250ZW50RWwoKSlcblx0XHRyZXR1cm5cblxuXG5cdHBhcmVudFNob3duOiAocGFyZW50KSAtPlxuXHRcdHN1cGVyKHBhcmVudClcblx0XHRAY29tcG9uZW50cy5lYWNoIChjb21wb25lbnQpIC0+XG5cdFx0XHRjb21wb25lbnQucGFyZW50U2hvd24ocGFyZW50KVxuXHRcdFx0cmV0dXJuXG5cdFx0cmV0dXJuXG5cblxuXHRkb0Rlc3Ryb3k6IC0+XG5cdFx0QHJlbW92ZUNvbXBvbmVudHMoKVxuXHRcdEBzZXRMYXlvdXQobnVsbCkgaWYgQGhhc0xheW91dCgpXG5cdFx0c3VwZXIoKVxuXG5cblxuXG5tb2R1bGUuZXhwb3J0cyA9IENvbnRhaW5lciIsIk1pd29PYmplY3QgPSByZXF1aXJlICcuLi9jb3JlL09iamVjdCdcblxuXG5jbGFzcyBTdGF0ZU1hbmFnZXIgZXh0ZW5kcyBNaXdvT2JqZWN0XG5cblx0c3RhdGVQZXJzaXN0ZXI6IEBpbmplY3QoJ3N0YXRlUGVyc2lzdGVyJywgJ2NvbXBvbmVudFN0YXRlUGVyc2lzdGVyJylcblxuXG5cdGxvYWRTdGF0ZTogKHN0YXRlTmFtZSkgLT5cblx0XHR2YWx1ZXMgPSBAc3RhdGVQZXJzaXN0ZXIubG9hZChzdGF0ZU5hbWUpXG5cdFx0cmV0dXJuIG5ldyBTdGF0ZSh0aGlzLCBzdGF0ZU5hbWUsIHZhbHVlc3x8e30pXG5cblxuXHRzYXZlU3RhdGU6IChzdGF0ZSkgLT5cblx0XHRAc3RhdGVQZXJzaXN0ZXIuc2F2ZShzdGF0ZS5uYW1lLCBzdGF0ZS52YWx1ZXMpXG5cdFx0cmV0dXJuXG5cblxuXG5jbGFzcyBTdGF0ZVxuXG5cblx0Y29uc3RydWN0b3I6IChAbWdyLCBAbmFtZSwgQGRhdGEpIC0+XG5cdFx0cmV0dXJuXG5cblxuXHRnZXQ6IChuYW1lLCBkZWYpIC0+XG5cdFx0cmV0dXJuIGlmIEBkYXRhLmhhc093blByb3BlcnR5KG5hbWUpIHRoZW4gQGRhdGFbbmFtZV0gZWxzZSBkZWZcblxuXG5cdHNldDogKG5hbWUsIHZhbHVlKSAtPlxuXHRcdGlmIHZhbHVlIGlzbnQgdW5kZWZpbmVkXG5cdFx0XHRAZGF0YVtuYW1lXSA9IHZhbHVlXG5cdFx0ZWxzZVxuXHRcdFx0ZGVsZXRlIEBkYXRhW25hbWVdXG5cdFx0cmV0dXJuIHRoaXNcblxuXG5cdHNhdmU6IC0+XG5cdFx0QG1nci5zYXZlU3RhdGUodGhpcylcblx0XHRyZXR1cm4gdGhpc1xuXG5cblxubW9kdWxlLmV4cG9ydHMgPSBTdGF0ZU1hbmFnZXIiLCJNaXdvT2JqZWN0ID0gcmVxdWlyZSAnLi4vY29yZS9PYmplY3QnXG5cblxuY2xhc3MgU3RhdGVQZXJzaXN0ZXIgZXh0ZW5kcyBNaXdvT2JqZWN0XG5cblx0c3RhdGU6IG51bGxcblxuXG5cdGNvbnN0cnVjdG9yOiAtPlxuXHRcdHN1cGVyXG5cdFx0QHN0YXRlID0ge31cblx0XHRyZXR1cm5cblxuXG5cdGxvYWQ6IChuYW1lKSAtPlxuXHRcdHJldHVybiBAc3RhdGVbbmFtZV1cblxuXG5cdHNhdmU6IChuYW1lLCBkYXRhKSAtPlxuXHRcdEBzdGF0ZVtuYW1lXSA9IGRhdGFcblx0XHRyZXR1cm5cblxuXG5tb2R1bGUuZXhwb3J0cyA9IFN0YXRlUGVyc2lzdGVyIiwiTWl3b09iamVjdCA9IHJlcXVpcmUgJy4uL2NvcmUvT2JqZWN0J1xuT3ZlcmxheSA9IHJlcXVpcmUgJy4uL3V0aWxzL092ZXJsYXknXG5cblxuY2xhc3MgWkluZGV4TWFuYWdlciBleHRlbmRzIE1pd29PYmplY3RcblxuXHR6SW5kZXhCYXNlOiAxMDAwMFxuXHR6SW5kZXg6IDBcblx0bGlzdDogbnVsbFxuXHRzdGFjazogbnVsbFxuXHRmcm9udDogbnVsbFxuXHRvdmVybGF5OiBudWxsXG5cblxuXHRjb25zdHJ1Y3RvcjogLT5cblx0XHRzdXBlclxuXHRcdEBsaXN0ID0ge31cblx0XHRAc3RhY2sgPSBbXVxuXHRcdEB6SW5kZXggPSBAekluZGV4QmFzZVxuXHRcdHJldHVyblxuXG5cblx0IyBSZWdpc3RlcnMgYSBmbG9hdGluZyB7QGxpbmsgTWl3by5jb21wb25lbnQuQ29tcG9uZW50fSB3aXRoIHRoaXMgWkluZGV4TWFuYWdlci4gVGhpcyBzaG91bGQgbm90XG5cdCMgbmVlZCB0byBiZSBjYWxsZWQgdW5kZXIgbm9ybWFsIGNpcmN1bXN0YW5jZXMuIEZsb2F0aW5nIENvbXBvbmVudHMgKHN1Y2ggYXMgV2luZG93cyxcblx0IyBCb3VuZExpc3RzIGFuZCBNZW51cykgYXJlIGF1dG9tYXRpY2FsbHkgcmVnaXN0ZXJlZFxuXHQjIEBwYXJhbSB7TWl3by5jb21wb25lbnQuQ29tcG9uZW50fSBjb21wIFRoZSBDb21wb25lbnQgdG8gcmVnaXN0ZXIuXG5cdHJlZ2lzdGVyOiAoY29tcCkgLT5cblx0XHRjb21wLnpJbmRleE1nci51bnJlZ2lzdGVyKGNvbXApICBpZiBjb21wLnpJbmRleE1nclxuXHRcdGNvbXAuekluZGV4TWdyID0gdGhpc1xuXHRcdEBsaXN0W2NvbXAuaWRdID0gY29tcFxuXHRcdEBzdGFjay5wdXNoKGNvbXApXG5cdFx0Y29tcC5vbihcImhpZGVcIiwgQGJvdW5kKFwib25Db21wb25lbnRIaWRlXCIpKVxuXHRcdHJldHVyblxuXG5cblx0IyBVbnJlZ2lzdGVycyBhIHtAbGluayBNaXdvLmNvbXBvbmVudC5Db21wb25lbnR9IGZyb20gdGhpcyBaSW5kZXhNYW5hZ2VyLiBUaGlzIHNob3VsZCBub3Rcblx0IyBuZWVkIHRvIGJlIGNhbGxlZC4gQ29tcG9uZW50cyBhcmUgYXV0b21hdGljYWxseSB1bnJlZ2lzdGVyZWQgdXBvbiBkZXN0cnVjdGlvbi5cblx0IyBAcGFyYW0ge01pd28uY29tcG9uZW50LkNvbXBvbmVudH0gY29tcCBUaGUgQ29tcG9uZW50IHRvIHVucmVnaXN0ZXIuXG5cdHVucmVnaXN0ZXI6IChjb21wKSAtPlxuXHRcdGlmIEBsaXN0W2NvbXAuaWRdXG5cdFx0XHRjb21wLnVuKFwiaGlkZVwiLCBAYm91bmQoXCJvbkNvbXBvbmVudEhpZGVcIikpXG5cdFx0XHRkZWxldGUgQGxpc3RbY29tcC5pZF1cblx0XHRcdEBzdGFjay5lcmFzZShjb21wKVxuXHRcdFx0ZGVsZXRlIGNvbXAuekluZGV4TWdyXG5cdFx0XHRAYWN0aXZhdGVMYXN0KCkgaWYgQGZyb250IGlzIGNvbXBcblx0XHRyZXR1cm5cblxuXG5cdCMgR2V0cyBhIHJlZ2lzdGVyZWQgQ29tcG9uZW50IGJ5IGlkLlxuXHQjIEByZXR1cm4ge01pd28uY29tcG9uZW50LkNvbXBvbmVudH1cblx0Z2V0OiAoaWQpIC0+XG5cdFx0cmV0dXJuIChpZiBpZC5pc0NvbXBvbmVudCB0aGVuIGlkIGVsc2UgQGxpc3RbaWRdKVxuXG5cblx0IyBHZXRzIHRoZSBjdXJyZW50bHktYWN0aXZlIENvbXBvbmVudCBpbiB0aGlzIFpJbmRleE1hbmFnZXIuXG5cdCMgQHJldHVybiB7TWl3by5jb21wb25lbnQuQ29tcG9uZW50fSBUaGUgYWN0aXZlIENvbXBvbmVudFxuXHRnZXRBY3RpdmU6IC0+XG5cdFx0cmV0dXJuIEBmcm9udFxuXG5cblx0b25Db21wb25lbnRIaWRlOiAtPlxuXHRcdEBhY3RpdmF0ZUxhc3QoKVxuXHRcdHJldHVyblxuXG5cblx0YWN0dWFsaXplOiAtPlxuXHRcdEB6SW5kZXggPSBAc2V0WkluZGV4aWVzKEB6SW5kZXhCYXNlKVxuXHRcdHJldHVyblxuXG5cblx0c2V0WkluZGV4aWVzOiAoekluZGV4KSAtPlxuXHRcdGZvciBjb21wIGluIEBzdGFja1xuXHRcdFx0ekluZGV4ID0gY29tcC5zZXRaSW5kZXgoekluZGV4KSAjIHJldHVybnMgbmV3IHotaW5kZXhcblx0XHRAYWN0aXZhdGVMYXN0KClcblx0XHRyZXR1cm4gekluZGV4XG5cblxuXHRzZXRBY3RpdmVDaGlsZDogKGNvbXAsIG9sZEZyb250KSAtPlxuXHRcdGlmIGNvbXAgaXNudCBAZnJvbnRcblx0XHRcdGlmIEBmcm9udCBhbmQgIUBmcm9udC5kZXN0cm95aW5nXG5cdFx0XHRcdEBmcm9udC5zZXRBY3RpdmUoZmFsc2UsIGNvbXApXG5cdFx0XHRAZnJvbnQgPSBjb21wXG5cdFx0XHRpZiBjb21wIGFuZCBjb21wIGlzbnQgb2xkRnJvbnRcblx0XHRcdFx0IyBJZiB0aGUgcHJldmlvdXNseSBhY3RpdmUgY29tcCBkaWQgbm90IHRha2UgZm9jdXMsIHRoZW4gZG8gbm90IGRpc3R1cmIgZm9jdXMgc3RhdGUgYnkgZm9jdXNpbmcgdGhlIG5ldyBmcm9udFxuXHRcdFx0XHQjIGNvbXAucHJldmVudEZvY3VzT25BY3RpdmF0ZSA9IG9sZEZyb250ICYmIChvbGRGcm9udC5wcmV2ZW50Rm9jdXNPbkFjdGl2YXRlIHx8ICFvbGRGcm9udC5mb2N1c09uVG9Gcm9udCk7XG5cdFx0XHRcdGlmIGNvbXAuZm9jdXNPblRvRnJvbnRcblx0XHRcdFx0XHRjb21wLnNldEZvY3VzKClcblx0XHRcdFx0Y29tcC5zZXRBY3RpdmUodHJ1ZSlcblx0XHRcdFx0aWYgY29tcC5tb2RhbFxuXHRcdFx0XHRcdEBzaG93T3ZlcmxheShjb21wKVxuXG5cdFx0XHRcdCMgUmVzdG9yZSB0aGUgbmV3IGZyb250J3MgZm9jdXNpbmcgZmxhZ1xuXHRcdFx0XHQjIGNvbXAucHJldmVudEZvY3VzT25BY3RpdmF0ZSA9IG9sZFByZXZlbnRGb2N1cztcblx0XHRyZXR1cm5cblxuXG5cdGFjdGl2YXRlTGFzdDogLT5cblx0XHRpbmRleCA9IEBzdGFjay5sZW5ndGggLSAxXG5cblx0XHQjIEdvIGRvd24gdGhyb3VnaCB0aGUgei1pbmRleCBzdGFjay5cblx0XHQjIEFjdGl2YXRlIHRoZSBuZXh0IHZpc2libGUgb25lIGRvd24uXG5cdFx0IyBJZiB0aGF0IHdhcyBtb2RhbCwgdGhlbiB3ZSdyZSBkb25lXG5cdFx0d2hpbGUgaW5kZXggPj0gMCBhbmQgIUBzdGFja1tpbmRleF0uaXNWaXNpYmxlKClcblx0XHRcdGluZGV4LS1cblxuXHRcdCMgVGhlIGxvb3AgZm91bmQgYSB2aXNpYmxlIGZsb2F0ZXIgdG8gYWN0aXZhdGVcblx0XHRpZiBpbmRleCA+PSAwXG5cdFx0XHRjb21wID0gQHN0YWNrW2luZGV4XVxuXHRcdFx0QHNldEFjdGl2ZUNoaWxkKGNvbXAsIEBmcm9udClcblx0XHRcdGlmIGNvbXAubW9kYWwgdGhlbiByZXR1cm5cblx0XHQjIE5vIG90aGVyIGZsb2F0ZXIgdG8gYWN0aXZhdGUsIGp1c3QgZGVhY3RpdmF0ZSB0aGUgY3VycmVudCBvbmVcblx0XHRlbHNlXG5cdFx0XHRAZnJvbnQuc2V0QWN0aXZlKGZhbHNlKSAgaWYgQGZyb250XG5cdFx0XHRAZnJvbnQgPSBudWxsXG5cblx0XHQjIElmIHRoZSBuZXcgdG9wIG9uZSB3YXMgbm90IG1vZGFsLCBrZWVwIGdvaW5nIGRvd24gdG8gZmluZCB0aGUgbmV4dCB2aXNpYmxlXG5cdFx0IyBtb2RhbCBvbmUgdG8gc2hpZnQgdGhlIG1vZGFsIG1hc2sgZG93biB1bmRlclxuXHRcdHdoaWxlIGluZGV4ID49IDBcblx0XHRcdGNvbXAgPSBAc3RhY2tbaW5kZXhdXG5cdFx0XHQjIElmIHdlIGZpbmQgYSB2aXNpYmxlIG1vZGFsIGZ1cnRoZXIgZG93biB0aGUgekluZGV4IHN0YWNrLCBtb3ZlIHRoZSBtYXNrIHRvIGp1c3QgdW5kZXIgaXQuXG5cdFx0XHRpZiBjb21wLmlzVmlzaWJsZSgpIGFuZCBjb21wLm1vZGFsXG5cdFx0XHRcdEBzaG93T3ZlcmxheShjb21wKVxuXHRcdFx0XHRyZXR1cm5cblx0XHRcdGluZGV4LS1cblxuXHRcdCMgTm8gdmlzaWJsZSBtb2RhbCBDb21wb25lbnQgd2FzIGZvdW5kIGluIHRoZSBydW4gZG93biB0aGUgc3RhY2suXG5cdFx0IyBTbyBoaWRlIHRoZSBtb2RhbCBtYXNrXG5cdFx0QGhpZGVPdmVybGF5KClcblx0XHRyZXR1cm5cblxuXG5cdHNob3dPdmVybGF5OiAoY29tcCkgLT5cblx0XHRpZiAhQG92ZXJsYXlcblx0XHRcdEBvdmVybGF5ID0gbmV3IE92ZXJsYXkobWl3by5ib2R5KVxuXHRcdFx0QG92ZXJsYXkub24gJ2NsaWNrJywgKCk9PlxuXHRcdFx0XHRpZiBAZnJvbnRcblx0XHRcdFx0XHRAZnJvbnQuc2V0Rm9jdXModHJ1ZSlcblx0XHRcdFx0XHRAZnJvbnQub25PdmVybGF5Q2xpY2soKSAgaWYgQGZyb250Lm9uT3ZlcmxheUNsaWNrXG5cdFx0XHRcdHJldHVyblxuXG5cdFx0QG92ZXJsYXkuc2V0WkluZGV4KGNvbXAuZ2V0WkluZGV4KCkgLSAxKVxuXHRcdEBvdmVybGF5Lm9wZW4oKVxuXHRcdHJldHVyblxuXG5cblx0aGlkZU92ZXJsYXk6IC0+XG5cdFx0aWYgQG92ZXJsYXlcblx0XHRcdEBvdmVybGF5LmNsb3NlKClcblx0XHRyZXR1cm5cblxuXG5cdCMgQnJpbmdzIHRoZSBzcGVjaWZpZWQgQ29tcG9uZW50IHRvIHRoZSBmcm9udCBvZiBhbnkgb3RoZXIgYWN0aXZlIENvbXBvbmVudHMgaW4gdGhpcyBaSW5kZXhNYW5hZ2VyLlxuXHQjIEBwYXJhbSB7U3RyaW5nL09iamVjdH0gY29tcCBUaGUgaWQgb2YgdGhlIENvbXBvbmVudCBvciBhIHtAbGluayBNaXdvLmNvbXBvbmVudC5Db21wb25lbnR9IGluc3RhbmNlXG5cdCMgQHJldHVybiB7Qm9vbGVhbn0gVHJ1ZSBpZiB0aGUgZGlhbG9nIHdhcyBicm91Z2h0IHRvIHRoZSBmcm9udCwgZWxzZSBmYWxzZSBpZiBpdCB3YXMgYWxyZWFkeSBpbiBmcm9udFxuXHRicmluZ1RvRnJvbnQ6IChjb21wKSAtPlxuXHRcdGNoYW5nZWQgPSBmYWxzZVxuXHRcdGNvbXAgPSBAZ2V0KGNvbXApXG5cdFx0aWYgY29tcCBpc250IEBmcm9udFxuXHRcdFx0QHN0YWNrLmVyYXNlKGNvbXApXG5cdFx0XHRAc3RhY2sucHVzaChjb21wKVxuXHRcdFx0QGFjdHVhbGl6ZSgpXG5cdFx0XHRAZnJvbnQgPSBjb21wXG5cdFx0XHRjaGFuZ2VkID0gdHJ1ZVxuXHRcdGlmIGNoYW5nZWQgYW5kIGNvbXAubW9kYWxcblx0XHRcdEBzaG93T3ZlcmxheShjb21wKVxuXHRcdHJldHVybiBjaGFuZ2VkXG5cblxuXHQjIFNlbmRzIHRoZSBzcGVjaWZpZWQgQ29tcG9uZW50IHRvIHRoZSBiYWNrIG9mIG90aGVyIGFjdGl2ZSBDb21wb25lbnRzIGluIHRoaXMgWkluZGV4TWFuYWdlci5cblx0IyBAcGFyYW0ge1N0cmluZy9PYmplY3R9IGNvbXAgVGhlIGlkIG9mIHRoZSBDb21wb25lbnQgb3IgYSB7TWl3by5jb21wb25lbnQuQ29tcG9uZW50fSBpbnN0YW5jZVxuXHQjIEByZXR1cm4ge01pd28uY29tcG9uZW50LkNvbXBvbmVudH0gVGhlIENvbXBvbmVudFxuXHRzZW5kVG9CYWNrOiAoY29tcCkgLT5cblx0XHRjb21wID0gQGdldChjb21wKVxuXHRcdEBzdGFjay5lcmFzZShjb21wKVxuXHRcdEBzdGFjay51bnNoaWZ0KGNvbXApXG5cdFx0QGFjdHVhbGl6ZSgpXG5cdFx0cmV0dXJuIGNvbXBcblxuXG5cdGRvRGVzdHJveTogLT5cblx0XHRpZiBAb3ZlcmxheVxuXHRcdFx0QG92ZXJsYXkuZGVzdHJveSgpXG5cdFx0XHRkZWxldGUgQG92ZXJsYXlcblxuXHRcdGZvciBpZCBvZiBAbGlzdFxuXHRcdFx0QHVucmVnaXN0ZXIoQGdldChpZCkpXG5cblx0XHRkZWxldGUgQGZyb250XG5cdFx0ZGVsZXRlIEBzdGFja1xuXHRcdGRlbGV0ZSBAbGlzdFxuXHRcdHN1cGVyKClcblx0XHRyZXR1cm5cblxuXG5tb2R1bGUuZXhwb3J0cyA9IFpJbmRleE1hbmFnZXIiLCJtb2R1bGUuZXhwb3J0cyA9XG5cdENvbXBvbmVudDogcmVxdWlyZSAnLi9Db21wb25lbnQnXG5cdENvbnRhaW5lcjogcmVxdWlyZSAnLi9Db250YWluZXInXG5cdENvbXBvbmVudE1hbmFnZXI6IHJlcXVpcmUgJy4vQ29tcG9uZW50TWFuYWdlcidcblx0Q29tcG9uZW50U2VsZWN0b3I6IHJlcXVpcmUgJy4vQ29tcG9uZW50U2VsZWN0b3InXG5cdFpJbmRleE1hbmFnZXI6IHJlcXVpcmUgJy4vWkluZGV4TWFuYWdlcidcblx0U3RhdGVNYW5hZ2VyOiByZXF1aXJlICcuL1N0YXRlTWFuYWdlcidcblx0U3RhdGVQZXJzaXN0ZXI6IHJlcXVpcmUgJy4vU3RhdGVQZXJzaXN0ZXInIiwiI1xuIyBGdW5jdGlvblxuI1xuRnVuY3Rpb246OmdldHRlciA9IChwcm9wLCBnZXR0ZXIpIC0+XG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eSBAcHJvdG90eXBlLCBwcm9wLCB7Z2V0OmdldHRlciwgY29uZmlndXJhYmxlOiB5ZXN9XG5cdHJldHVybiBudWxsXG5cbkZ1bmN0aW9uOjpzZXR0ZXIgPSAocHJvcCwgc2V0dGVyKSAtPlxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkgQHByb3RvdHlwZSwgcHJvcCwge3NldDogc2V0dGVyLCBjb25maWd1cmFibGU6IHllc31cblx0cmV0dXJuIG51bGxcblxuRnVuY3Rpb246OnByb3BlcnR5ID0gKHByb3AsIGRlZikgLT5cblx0T2JqZWN0LmRlZmluZVByb3BlcnR5IEBwcm90b3R5cGUsIHByb3AsIGRlZlxuXHRyZXR1cm4gbnVsbFxuXG5GdW5jdGlvbjo6aW5qZWN0ID0gKG5hbWUsIHNlcnZpY2UpIC0+XG5cdEBwcm90b3R5cGUuaW5qZWN0cyA9IHt9IGlmICFAcHJvdG90eXBlLmluamVjdHNcblx0QHByb3RvdHlwZS5pbmplY3RzW25hbWVdID0gc2VydmljZSB8fCBuYW1lXG5cdHJldHVybiBudWxsXG5cblxuTnVtYmVyOjpwYWQgPSAobGVuZ3RoLCBjaGFyID0gJzAnKSAtPlxuXHRzdHIgPSAnJyArIHRoaXNcblx0d2hpbGUgc3RyLmxlbmd0aCA8IGxlbmd0aFxuXHRcdHN0ciA9IGNoYXIgKyBzdHJcblx0cmV0dXJuIHN0ciIsIkVsZW1lbnQuUHJvcGVydGllcy5jbHMgPVxuXHRnZXQ6IC0+XG5cdFx0cmV0dXJuIEBnZXQoXCJjbGFzc1wiKVxuXG5cdHNldDogKHYpIC0+XG5cdFx0cmV0dXJuIEBzZXQoXCJjbGFzc1wiLCB2KVxuXG5cdGVyYXNlOiAtPlxuXHRcdEBlcmFzZShcImNsYXNzXCIpXG5cdFx0cmV0dXJuXG5cblxuRWxlbWVudC5Qcm9wZXJ0aWVzLnBhcmVudCA9XG5cdGdldDogLT5cblx0XHRyZXR1cm4gQGdldFBhcmVudCgpICNyZXR1cm5zIHRoZSBlbGVtZW50J3MgcGFyZW50XG5cblx0c2V0OiAocCkgLT5cblx0XHRAaW5qZWN0KHApICBpZiBwXG5cdFx0cmV0dXJuXG5cblxuRWxlbWVudC5Qcm9wZXJ0aWVzLmNoaWxkcmVuID1cblx0Z2V0OiAtPlxuXHRcdHJldHVybiBAZ2V0Q2hpbGRyZW4oKVxuXG5cdHNldDogKHZhbHVlKSAtPlxuXHRcdEBhZG9wdCh2YWx1ZSlcblx0XHRyZXR1cm5cblxuXG5FbGVtZW50LlByb3BlcnRpZXMubG9jYXRpb24gPVxuXHRzZXQ6IChsKSAtPlxuXHRcdEBzZXRTdHlsZSBcInRvcFwiLCBsWzBdICBpZiBsWzBdIGlzbnQgbnVsbFxuXHRcdEBzZXRTdHlsZSBcInJpZ2h0XCIsIGxbMV0gIGlmIGxbMV0gaXNudCBudWxsXG5cdFx0QHNldFN0eWxlIFwiYm90dG9tXCIsIGxbMl0gIGlmIGxbMl0gaXNudCBudWxsXG5cdFx0QHNldFN0eWxlIFwibGVmdFwiLCBsWzNdICBpZiBsWzNdIGlzbnQgbnVsbFxuXHRcdHJldHVyblxuXG5cbkVsZW1lbnQuUHJvcGVydGllcy5vbiA9XG5cdHNldDogKG8pIC0+XG5cdFx0QGFkZEV2ZW50cyhvKVxuXHRcdHJldHVyblxuXG5cbkVsZW1lbnQuaW1wbGVtZW50KHtcblxuXHRpc0Rpc3BsYXllZDogLT5cblx0XHRyZXR1cm4gQGdldFN0eWxlKCdkaXNwbGF5JykgaXNudCAnbm9uZSdcblxuXG5cdGlzVmlzaWJsZTogLT5cblx0XHR3ID0gQG9mZnNldFdpZHRoXG5cdFx0aCA9IEBvZmZzZXRIZWlnaHRcblx0XHRpZiB3IGlzIDAgJiYgaCBpcyAwXG5cdFx0XHRyZXR1cm4gZmFsc2Vcblx0XHRlbHNlIGlmIHcgPiAwICYmIGggPiAwXG5cdFx0XHRyZXR1cm4gdHJ1ZVxuXHRcdGVsc2Vcblx0XHRcdHJldHVybiBAc3R5bGUuZGlzcGxheSBpc250ICdub25lJ1xuXG5cblx0dG9nZ2xlOiAtPlxuXHRcdHJldHVybiB0aGlzW2lmIEBpc0Rpc3BsYXllZCgpIHRoZW4gJ2hpZGUnIGVsc2UgJ3Nob3cnXSgpO1xuXG5cblx0aGlkZTogLT5cblx0XHQjSUUgZmFpbHMgaGVyZSBpZiB0aGUgZWxlbWVudCBpcyBub3QgaW4gdGhlIGRvbVxuXHRcdHRyeSBkID0gQGdldFN0eWxlKCdkaXNwbGF5JykgY2F0Y2ggZVxuXHRcdGlmIGQgaXMgJ25vbmUnIHRoZW4gcmV0dXJuIHRoaXNcblx0XHRyZXR1cm4gQHN0b3JlKCdlbGVtZW50Ol9vcmlnaW5hbERpc3BsYXknLCBkIHx8ICcnKS5zZXRTdHlsZSgnZGlzcGxheScsICdub25lJylcblxuXG5cdHNob3c6IChkaXNwbGF5KSAtPlxuXHRcdGlmICFkaXNwbGF5ICYmIEBpc0Rpc3BsYXllZCgpIHRoZW4gcmV0dXJuIHRoaXNcblx0XHRkaXNwbGF5ID0gZGlzcGxheSB8fCBAcmV0cmlldmUoJ2VsZW1lbnQ6X29yaWdpbmFsRGlzcGxheScpIHx8ICdibG9jaydcblx0XHRyZXR1cm4gQHNldFN0eWxlKCdkaXNwbGF5JywgaWYgZGlzcGxheSBpcyAnbm9uZScgdGhlbiAgJ2Jsb2NrJyBlbHNlIGRpc3BsYXkpXG5cblxuXHRzZXRWaXNpYmxlOiAodmlzaWJsZSkgLT5cblx0XHR0aGlzWyhpZiB2aXNpYmxlIHRoZW4gXCJzaG93XCIgZWxzZSBcImhpZGVcIildKClcblx0XHRyZXR1cm5cblxuXG5cdHRvZ2dsZUNsYXNzOiAoY2xzLCB0b2dnbGVkKSAtPlxuXHRcdGlmIHRvZ2dsZWQgaXMgdHJ1ZSB8fCB0b2dnbGVkIGlzIGZhbHNlXG5cdFx0XHRpZiB0b2dnbGVkIGlzIHRydWVcblx0XHRcdFx0QGFkZENsYXNzKGNscykgaWYgIUBoYXNDbGFzcyhjbHMpXG5cdFx0XHRlbHNlXG5cdFx0XHRcdEByZW1vdmVDbGFzcyhjbHMpIGlmIEBoYXNDbGFzcyhjbHMpXG5cdFx0ZWxzZVxuXHRcdFx0aWYgQGhhc0NsYXNzKGNscylcblx0XHRcdFx0QHJlbW92ZUNsYXNzKGNscylcblx0XHRcdGVsc2Vcblx0XHRcdFx0QGFkZENsYXNzKGNscylcblx0XHRyZXR1cm4gdGhpc1xuXG5cblx0c3dhcENsYXNzOiAocmVtb3ZlLCBhZGQpIC0+XG5cdFx0cmV0dXJuIEByZW1vdmVDbGFzcyhyZW1vdmUpLmFkZENsYXNzKGFkZClcblxuXG5cdGdldEluZGV4OiAocXVlcnkpIC0+XG5cdFx0cmV0dXJuIHRoaXMuZ2V0QWxsUHJldmlvdXMocXVlcnkpLmxlbmd0aFxuXG5cblx0c2V0Rm9jdXM6ICh0YWJJbmRleCkgLT5cblx0XHRAc2V0QXR0cmlidXRlKCBcInRhYkluZGV4XCIsIHRhYkluZGV4IG9yIDApXG5cdFx0QGZvY3VzKClcblx0XHRyZXR1cm5cblxuXG5cdHNldENsYXNzOiAoY2xzLCBlbmFibGVkKSAtPlxuXHRcdGlmIGVuYWJsZWRcblx0XHRcdEBhZGRDbGFzcyhjbHMpIGlmICFAaGFzQ2xhc3MoY2xzKVxuXHRcdGVsc2Vcblx0XHRcdEByZW1vdmVDbGFzcyhjbHMpIGlmIEBoYXNDbGFzcyhjbHMpXG5cdFx0cmV0dXJuXG59KVxuXG5cbiMgZXZlbnQgc2hvcnRjdXRzXG5FdmVudFNob3J0Y3V0cyA9XG5cdGVtaXQ6ICh0eXBlLCBhcmdzLCBkZWxheSkgLT5cblx0XHRAZmlyZUV2ZW50IHR5cGUsIGFyZ3MsIGRlbGF5XG5cblx0b246ICh0eXBlLCBmbikgLT5cblx0XHRpZiBUeXBlLmlzU3RyaW5nKHR5cGUpXG5cdFx0XHRAYWRkRXZlbnQgdHlwZSwgZm5cblx0XHRlbHNlXG5cdFx0XHRAYWRkRXZlbnRzIHR5cGVcblxuXHR1bjogKHR5cGUsIGZuKSAtPlxuXHRcdGlmIFR5cGUuaXNTdHJpbmcodHlwZSlcblx0XHRcdEByZW1vdmVFdmVudCB0eXBlLCBmblxuXHRcdGVsc2Vcblx0XHRcdEByZW1vdmVFdmVudHMgdHlwZVxuXG5PYmplY3QuYXBwZW5kKHdpbmRvdywgRXZlbnRTaG9ydGN1dHMpXG5PYmplY3QuYXBwZW5kKGRvY3VtZW50LCBFdmVudFNob3J0Y3V0cylcblJlcXVlc3QuaW1wbGVtZW50KEV2ZW50U2hvcnRjdXRzKVxuRXZlbnRzLmltcGxlbWVudChFdmVudFNob3J0Y3V0cylcbkVsZW1lbnQuaW1wbGVtZW50KEV2ZW50U2hvcnRjdXRzKVxuIiwiTmF0aXZlRXZlbnRzID0gcmVxdWlyZSgnZXZlbnRzJylcblxuY2xhc3MgRXZlbnRzIGV4dGVuZHMgTmF0aXZlRXZlbnRzXG5cblx0bWFuYWdlZExpc3RlbmVyczogbnVsbFxuXHRtYW5hZ2VkUmVsYXlzOiBudWxsXG5cdGJvdW5kczogbnVsbFxuXG5cblx0Y29uc3RydWN0b3I6ICgpIC0+XG5cdFx0QG1hbmFnZWRMaXN0ZW5lcnMgPSBbXVxuXHRcdEBtYW5hZ2VkUmVsYXlzID0gW11cblx0XHRAYm91bmRzID0ge31cblxuXG5cdGJvdW5kOiAobmFtZSkgLT5cblx0XHRpZiAhQGJvdW5kc1tuYW1lXVxuXHRcdFx0aWYgIUBbbmFtZV0gdGhlbiB0aHJvdyBuZXcgRXJyb3IoXCJNZXRob2QgI3tuYW1lfSBpcyB1bmRlZmluZWQgaW4gb2JqZWN0ICN7QH1cIilcblx0XHRcdEBib3VuZHNbbmFtZV0gPSBAW25hbWVdLmJpbmQodGhpcylcblx0XHRyZXR1cm4gQGJvdW5kc1tuYW1lXVxuXG5cblx0YWRkTGlzdGVuZXI6IChuYW1lLCBsaXN0ZW5lcikgLT5cblx0XHRpZiBUeXBlLmlzU3RyaW5nKGxpc3RlbmVyKSB0aGVuIGxpc3RlbmVyID0gQGJvdW5kKGxpc3RlbmVyKVxuXHRcdHN1cGVyKG5hbWUsIGxpc3RlbmVyKVxuXHRcdHJldHVyblxuXG5cblx0YWRkTGlzdGVuZXJzOiAobGlzdGVuZXJzKSAtPlxuXHRcdGZvciBuYW1lLCBsaXN0ZW5lciBvZiBsaXN0ZW5lcnNcblx0XHRcdEBhZGRMaXN0ZW5lcihuYW1lLCBsaXN0ZW5lcilcblx0XHRyZXR1cm5cblxuXG5cdHJlbW92ZUxpc3RlbmVyOiAobmFtZSwgbGlzdGVuZXIpIC0+XG5cdFx0aWYgVHlwZS5pc1N0cmluZyhsaXN0ZW5lcikgdGhlbiBsaXN0ZW5lciA9IEBib3VuZChsaXN0ZW5lcilcblx0XHRzdXBlcihuYW1lLCBsaXN0ZW5lcilcblx0XHRyZXR1cm5cblxuXG5cdHJlbW92ZUxpc3RlbmVyczogKG5hbWUpIC0+XG5cdFx0QHJlbW92ZUFsbExpc3RlbmVycyhuYW1lKVxuXHRcdHJldHVyblxuXG5cblx0b246IChuYW1lLCBsaXN0ZW5lcikgLT5cblx0XHRpZiBUeXBlLmlzT2JqZWN0KG5hbWUpXG5cdFx0XHRAYWRkTGlzdGVuZXJzKG5hbWUpXG5cdFx0ZWxzZVxuXHRcdFx0QGFkZExpc3RlbmVyKG5hbWUsIGxpc3RlbmVyKVxuXHRcdHJldHVyblxuXG5cblx0dW46IChuYW1lLCBsaXN0ZW5lcikgLT5cblx0XHRpZiBsaXN0ZW5lclxuXHRcdFx0QHJlbW92ZUxpc3RlbmVyKG5hbWUsIGxpc3RlbmVyKVxuXHRcdGVsc2Vcblx0XHRcdGlmIFR5cGUuaXNPYmplY3QobmFtZSlcblx0XHRcdFx0Zm9yIG4sbCBvZiBuYW1lIHRoZW4gQHJlbW92ZUxpc3RlbmVyKG4sIGwpXG5cdFx0XHRlbHNlXG5cdFx0XHRcdEByZW1vdmVMaXN0ZW5lcnMobmFtZSlcblx0XHRyZXR1cm5cblxuXG5cblxuXHRhZGRNYW5hZ2VkTGlzdGVuZXI6IChvYmplY3QsIG5hbWUsIGxpc3RlbmVyKSAtPlxuXHRcdGlmIFR5cGUuaXNTdHJpbmcobGlzdGVuZXIpIHRoZW4gbGlzdGVuZXIgPSBAYm91bmQobGlzdGVuZXIpXG5cdFx0b2JqZWN0Lm9uKG5hbWUsIGxpc3RlbmVyKVxuXHRcdEBtYW5hZ2VkTGlzdGVuZXJzLnB1c2hcblx0XHRcdG9iamVjdDogb2JqZWN0XG5cdFx0XHRuYW1lOiBuYW1lXG5cdFx0XHRsaXN0ZW5lcjogbGlzdGVuZXJcblx0XHRyZXR1cm5cblxuXG5cdGFkZE1hbmFnZWRMaXN0ZW5lcnM6IChvYmplY3QsIGxpc3RlbmVycykgLT5cblx0XHRmb3IgbixsIG9mIGxpc3RlbmVyc1xuXHRcdFx0QGFkZE1hbmFnZWRMaXN0ZW5lcihvYmplY3QsIG4sIGwpXG5cdFx0cmV0dXJuXG5cblxuXHRyZW1vdmVNYW5hZ2VkTGlzdGVuZXJzOiAob2JqZWN0LCBuYW1lLCBsaXN0ZW5lcikgLT5cblx0XHR0b1JlbW92ZSA9IFtdXG5cdFx0Zm9yIG0gaW4gQG1hbmFnZWRMaXN0ZW5lcnNcblx0XHRcdGlmIFR5cGUuaXNTdHJpbmcobGlzdGVuZXIpIHRoZW4gbGlzdGVuZXIgPSBAYm91bmQobGlzdGVuZXIpXG5cdFx0XHRpZiAoIW9iamVjdCB8fCBtLm9iamVjdCBpcyBvYmplY3QpICYmICghbmFtZSB8fCBtLm5hbWUgaXMgbmFtZSkgJiYgKCFsaXN0ZW5lciB8fCBtLmxpc3RlbmVyIGlzIGxpc3RlbmVyKVxuXHRcdFx0XHR0b1JlbW92ZS5wdXNoKG0pXG5cdFx0Zm9yIG0gaW4gdG9SZW1vdmVcblx0XHRcdG0ub2JqZWN0LnVuKG0ubmFtZSwgbS5saXN0ZW5lcilcblx0XHRcdEBtYW5hZ2VkTGlzdGVuZXJzLmVyYXNlKG0pXG5cdFx0cmV0dXJuXG5cblxuXHRtb246IChvYmplY3QsIG5hbWUsIGxpc3RlbmVyKSAtPlxuXHRcdGlmIGxpc3RlbmVyXG5cdFx0XHRAYWRkTWFuYWdlZExpc3RlbmVyKG9iamVjdCwgbmFtZSwgbGlzdGVuZXIpXG5cdFx0ZWxzZVxuXHRcdFx0QGFkZE1hbmFnZWRMaXN0ZW5lcnMob2JqZWN0LCBuYW1lKVxuXHRcdHJldHVyblxuXG5cblx0bXVuOiAob2JqZWN0LCBuYW1lLCBsaXN0ZW5lcikgLT5cblx0XHRpZiBUeXBlLmlzT2JqZWN0KG5hbWUpXG5cdFx0XHRAcmVtb3ZlTWFuYWdlZExpc3RlbmVycyhvYmplY3QsIG4sIGwpICBmb3IgbixsIG9mIG5hbWVcblx0XHRlbHNlXG5cdFx0XHRAcmVtb3ZlTWFuYWdlZExpc3RlbmVycyhvYmplY3QsIG5hbWUsIGxpc3RlbmVyKVxuXHRcdHJldHVyblxuXG5cblx0bXVub246IChvbGQsIG9iaiwgbmFtZSwgbGlzdGVuZXIpIC0+XG5cdFx0I3JldHVybiAgaWYgb2xkIGlzIG9ialxuXHRcdEBtdW4ob2xkLCBuYW1lLCBsaXN0ZW5lcikgIGlmIG9sZFxuXHRcdEBtb24ob2JqLCBuYW1lLCBsaXN0ZW5lcikgIGlmIG9ialxuXHRcdHJldHVyblxuXG5cblx0X2Rlc3Ryb3lNYW5hZ2VkTGlzdGVuZXJzOiAtPlxuXHRcdEByZW1vdmVNYW5hZ2VkTGlzdGVuZXJzKClcblx0XHRyZXR1cm5cblxuXG5cblxuXHRyZWxheUV2ZW50czogKG9iamVjdCwgZXZlbnRzLCBwcmVmaXgpIC0+XG5cdFx0bGlzdGVuZXJzID0ge31cblx0XHRwcmVmaXggPSBwcmVmaXggfHwgJydcblx0XHRmb3IgZXZlbnQgaW4gZXZlbnRzXG5cdFx0XHRsaXN0ZW5lcnNbZXZlbnRdID0gQGNyZWF0ZVJlbGF5KGV2ZW50LCBwcmVmaXgpXG5cdFx0XHRvYmplY3QuYWRkTGlzdGVuZXIoZXZlbnQsIGxpc3RlbmVyc1tldmVudF0pXG5cdFx0cmV0dXJuIHtcblx0XHRcdHRhcmdldDogb2JqZWN0XG5cdFx0XHRkZXN0cm95OiAoKSAtPiBvYmplY3QucmVtb3ZlTGlzdGVuZXJzKGxpc3RlbmVycylcblx0XHR9XG5cblxuXHRjcmVhdGVSZWxheTogKGV2ZW50LCBwcmVmaXgpIC0+XG5cdFx0cmV0dXJuIChhcmdzLi4uKSA9PlxuXHRcdFx0YXJncy51bnNoaWZ0KHByZWZpeCtldmVudClcblx0XHRcdEBlbWl0LmFwcGx5KHRoaXMsIGFyZ3MpXG5cblxuXHRhZGRSZWxheTogKG9iamVjdCwgZXZlbnRzLCBwcmVmaXgpIC0+XG5cdFx0cmVsYXkgPSBAcmVsYXlFdmVudHMob2JqZWN0LCBldmVudHMsIHByZWZpeClcblx0XHRAbWFuYWdlZFJlbGF5cy5wdXNoXG5cdFx0XHRvYmplY3Q6IG9iamVjdFxuXHRcdFx0cmVsYXk6IHJlbGF5XG5cdFx0cmV0dXJuXG5cblxuXHRyZW1vdmVSZWxheTogKG9iamVjdCkgLT5cblx0XHR0b1JlbW92ZSA9IFtdXG5cdFx0Zm9yIHJlbGF5IGluIEBtYW5hZ2VkUmVsYXlzXG5cdFx0XHRpZiAhb2JqZWN0IG9yIHJlbGF5Lm9iamVjdCBpcyBvYmplY3Rcblx0XHRcdFx0dG9SZW1vdmUucHVzaChyZWxheSlcblx0XHRmb3IgcmVsYXkgaW4gdG9SZW1vdmVcblx0XHRcdHJlbGF5LnJlbGF5LmRlc3Ryb3koKVxuXHRcdFx0QG1hbmFnZWRSZWxheXMuZXJhc2UocmVsYXkpXG5cdFx0cmV0dXJuXG5cblxuXHRyZWxheTogKG9iamVjdCwgZXZlbnRzLCBwcmVmaXgpIC0+XG5cdFx0QGFkZFJlbGF5KG9iamVjdCwgZXZlbnRzLCBwcmVmaXgpXG5cdFx0cmV0dXJuXG5cblxuXHR1bnJlbGF5OiAob2JqZWN0KSAtPlxuXHRcdEByZW1vdmVSZWxheShvYmplY3QpXG5cdFx0cmV0dXJuXG5cblxuXHRfZGVzdHJveU1hbmFnZWRSZWxheXM6IC0+XG5cdFx0QHJlbW92ZVJlbGF5KClcblx0XHRyZXR1cm5cblxuXG5cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRzIiwiRXZlbnRzID0gcmVxdWlyZSAnLi9FdmVudHMnXG5cblxuY2xhc3MgTWl3b09iamVjdCBleHRlbmRzIEV2ZW50c1xuXG5cdGlzT2JqZWN0OiB0cnVlXG5cdGlzRGVzdHJveWVkOiBmYWxzZVxuXHRkZXN0cm95aW5nOiBmYWxzZVxuXG5cblx0Y29uc3RydWN0b3I6IChjb25maWcpIC0+XG5cdFx0c3VwZXIoKVxuXHRcdEBzZXRDb25maWcoY29uZmlnKVxuXHRcdHJldHVyblxuXG5cblx0c2V0Q29uZmlnOiAoY29uZmlnKSAtPlxuXHRcdGlmICFjb25maWcgdGhlbiByZXR1cm5cblx0XHRmb3IgaywgdiBvZiBjb25maWcgdGhlbiBAc2V0UHJvcGVydHkoayx2KVxuXHRcdHJldHVyblxuXG5cblx0c2V0UHJvcGVydHk6IChuYW1lLCB2YWx1ZSkgLT5cblx0XHRAW25hbWVdID0gdmFsdWUgaWYgdmFsdWUgaXNudCB1bmRlZmluZWRcblx0XHRyZXR1cm4gdGhpc1xuXG5cblx0c2V0OiAobmFtZSwgdmFsdWUpIC0+XG5cdFx0QHNldFByb3BlcnR5KG5hbWUsIHZhbHVlKVxuXHRcdHJldHVybiB0aGlzXG5cblxuXHRkZXN0cm95OiAtPlxuXHRcdGlmIEBpc0Rlc3Ryb3llZCB0aGVuIHJldHVyblxuXHRcdEBkZXN0cm95aW5nID0gdHJ1ZVxuXHRcdEBiZWZvcmVEZXN0cm95KClcblx0XHRAX2NhbGxEZXN0cm95KClcblx0XHRAZG9EZXN0cm95KClcblx0XHRAZGVzdHJveWluZyA9IGZhbHNlXG5cdFx0QGlzRGVzdHJveWVkID0gdHJ1ZVxuXHRcdEBhZnRlckRlc3Ryb3koKVxuXHRcdHJldHVyblxuXG5cblx0X2NhbGxEZXN0cm95OiAtPlxuXHRcdGZvciBuYW1lLG1ldGhvZCBvZiB0aGlzXG5cdFx0XHRpZiBuYW1lLmluZGV4T2YoXCJfZGVzdHJveVwiKSBpcyAwXG5cdFx0XHRcdG1ldGhvZC5jYWxsKHRoaXMpXG5cdFx0cmV0dXJuXG5cblxuXHR0b1N0cmluZzogLT5cblx0XHRyZXR1cm4gQGNvbnN0cnVjdG9yLm5hbWVcblxuXG5cdGJlZm9yZURlc3Ryb3k6IC0+XG5cdFx0QGJlZm9yZURlc3Ryb3lDYWxsZWQgPSB0cnVlXG5cdFx0cmV0dXJuXG5cblxuXHRkb0Rlc3Ryb3k6IC0+XG5cdFx0QGRvRGVzdHJveUNhbGxlZCA9IHRydWVcblx0XHRyZXR1cm5cblxuXG5cdGFmdGVyRGVzdHJveTogLT5cblx0XHRAYWZ0ZXJEZXN0cm95Q2FsbGVkID0gdHJ1ZVxuXHRcdHJldHVyblxuXG5cblxuTWl3b09iamVjdC5hZGRNZXRob2QgPSAobmFtZSwgbWV0aG9kKSAtPlxuXHRAcHJvdG90eXBlW25hbWVdID0gbWV0aG9kXG5cdHJldHVyblxuXG5cbm1vZHVsZS5leHBvcnRzID0gTWl3b09iamVjdCIsIlR5cGUuZXh0ZW5kXG5cblx0IyMjKlxuXHQgIFJldHVybnMgdHJ1ZSBpZiB0aGUgcGFzc2VkIHZhbHVlIGlzIGVtcHR5LlxuXHQgIFRoZSB2YWx1ZSBpcyBkZWVtZWQgdG8gYmUgZW1wdHkgaWYgaXQgaXNcblx0ICBudWxsXG5cdCAgdW5kZWZpbmVkXG5cdCAgYW4gZW1wdHkgYXJyYXlcblx0ICBhIHplcm8gbGVuZ3RoIHN0cmluZyAoVW5sZXNzIHRoZSBhbGxvd0JsYW5rIHBhcmFtZXRlciBpcyB0cnVlKVxuXHQgIEBwYXJhbSB7TWl4ZWR9IHYgVGhlIHZhbHVlIHRvIHRlc3Rcblx0ICBAcGFyYW0ge0Jvb2xlYW59IGFsbG93QmxhbmsgKG9wdGlvbmFsKSB0cnVlIHRvIGFsbG93IGVtcHR5IHN0cmluZ3MgKGRlZmF1bHRzIHRvIGZhbHNlKVxuXHQgIEByZXR1cm4ge0Jvb2xlYW59XG5cdCMjI1xuXHRpc0VtcHR5OiAodiwgYWxsb3dCbGFuaykgLT5cblx0XHR2IGlzIG51bGwgb3IgdiBpcyBgdW5kZWZpbmVkYCBvciAoVHlwZS5pc0FycmF5KHYpIGFuZCBub3Qgdi5sZW5ndGgpIG9yICgoaWYgbm90IGFsbG93QmxhbmsgdGhlbiB2IGlzIFwiXCIgZWxzZSBmYWxzZSkpXG5cblxuXHQjIyMqXG5cdCAgUmV0dXJucyB0cnVlIGlmIHRoZSBwYXNzZWQgdmFsdWUgaXMgYSBKYXZhU2NyaXB0IGFycmF5LCBvdGhlcndpc2UgZmFsc2UuXG5cdCAgQHBhcmFtIHtNaXhlZH0gdiBUaGUgdmFsdWUgdG8gdGVzdFxuXHQgIEByZXR1cm4ge0Jvb2xlYW59XG5cdCMjI1xuXHRpc0FycmF5OiAodikgLT5cblx0XHRPYmplY3Q6OnRvU3RyaW5nLmNhbGwodikgaXMgXCJbb2JqZWN0IEFycmF5XVwiXG5cblxuXHQjIyMqXG5cdCAgUmV0dXJucyB0cnVlIGlmIHRoZSBwYXNzZWQgb2JqZWN0IGlzIGEgSmF2YVNjcmlwdCBkYXRlIG9iamVjdCwgb3RoZXJ3aXNlIGZhbHNlLlxuXHQgIEBwYXJhbSB7T2JqZWN0fSB2IFRoZSBvYmplY3QgdG8gdGVzdFxuXHQgIEByZXR1cm4ge0Jvb2xlYW59XG5cdCMjI1xuXHRpc0RhdGU6ICh2KSAtPlxuXHRcdE9iamVjdDo6dG9TdHJpbmcuY2FsbCh2KSBpcyBcIltvYmplY3QgRGF0ZV1cIlxuXG5cblx0IyMjKlxuXHQgIFJldHVybnMgdHJ1ZSBpZiB0aGUgcGFzc2VkIHZhbHVlIGlzIGEgSmF2YVNjcmlwdCBPYmplY3QsIG90aGVyd2lzZSBmYWxzZS5cblx0ICBAcGFyYW0ge01peGVkfSB2IFRoZSB2YWx1ZSB0byB0ZXN0XG5cdCAgQHJldHVybiB7Qm9vbGVhbn1cblx0IyMjXG5cdGlzT2JqZWN0OiAodikgLT5cblx0XHQhIXYgYW5kIE9iamVjdDo6dG9TdHJpbmcuY2FsbCh2KSBpcyBcIltvYmplY3QgT2JqZWN0XVwiXG5cblxuXHQjIyMqXG5cdCAgUmV0dXJucyB0cnVlIGlmIHRoZSBwYXNzZWQgdmFsdWUgaXMgYSBKYXZhU2NyaXB0ICdwcmltaXRpdmUnLCBhIHN0cmluZywgbnVtYmVyIG9yIGJvb2xlYW4uXG5cdCAgQHBhcmFtIHtNaXhlZH0gdiBUaGUgdmFsdWUgdG8gdGVzdFxuXHQgIEByZXR1cm4ge0Jvb2xlYW59XG5cdCMjI1xuXHRpc1ByaW1pdGl2ZTogKHYpIC0+XG5cdFx0VHlwZS5pc1N0cmluZyh2KSBvciBUeXBlLmlzTnVtYmVyKHYpIG9yIFR5cGUuaXNCb29sZWFuKHYpXG5cblxuXHQjIyMqXG5cdCAgUmV0dXJucyB0cnVlIGlmIHRoZSBwYXNzZWQgdmFsdWUgaXMgYSBudW1iZXIuXG5cdCAgQHBhcmFtIHtNaXhlZH0gdiBUaGUgdmFsdWUgdG8gdGVzdFxuXHQgIEByZXR1cm4ge0Jvb2xlYW59XG5cdCMjI1xuXHRpc051bWJlcjogKHYpIC0+XG5cdFx0dHlwZW9mIHYgaXMgXCJudW1iZXJcIlxuXG5cblx0IyMjKlxuXHQgIFJldHVybnMgdHJ1ZSBpZiB0aGUgcGFzc2VkIHZhbHVlIGlzIGEgaW50ZWdlclxuXHQgIEBwYXJhbSB7TWl4ZWR9IG4gVGhlIHZhbHVlIHRvIHRlc3Rcblx0ICBAcmV0dXJuIHtCb29sZWFufVxuXHQjIyNcblx0aXNJbnRlZ2VyOiAobikgLT5cblx0XHRUeXBlLmlzTnVtYmVyKG4pIGFuZCAobiAlIDEgaXMgMClcblxuXG5cdCMjIypcblx0ICBSZXR1cm5zIHRydWUgaWYgdGhlIHBhc3NlZCB2YWx1ZSBpcyBhIGZsb2F0XG5cdCAgQHBhcmFtIHtNaXhlZH0gbiBUaGUgdmFsdWUgdG8gdGVzdFxuXHQgIEByZXR1cm4ge0Jvb2xlYW59XG5cdCMjI1xuXHRpc0Zsb2F0OiAobikgLT5cblx0XHRUeXBlLmlzTnVtYmVyKG4pIGFuZCAoL1xcLi8udGVzdChuLnRvU3RyaW5nKCkpKVxuXG5cblx0IyMjKlxuXHQgIFJldHVybnMgdHJ1ZSBpZiB0aGUgcGFzc2VkIHZhbHVlIGlzIGEgc3RyaW5nLlxuXHQgIEBwYXJhbSB7TWl4ZWR9IHYgVGhlIHZhbHVlIHRvIHRlc3Rcblx0ICBAcmV0dXJuIHtCb29sZWFufVxuXHQjIyNcblx0aXNTdHJpbmc6ICh2KSAtPlxuXHRcdHR5cGVvZiB2IGlzIFwic3RyaW5nXCJcblxuXG5cdCMjIypcblx0ICBSZXR1cm5zIHRydWUgaWYgdGhlIHBhc3NlZCB2YWx1ZSBpcyBhIGJvb2xlYW4uXG5cdCAgQHBhcmFtIHtNaXhlZH0gdiBUaGUgdmFsdWUgdG8gdGVzdFxuXHQgIEByZXR1cm4ge0Jvb2xlYW59XG5cdCMjI1xuXHRpc0Jvb2xlYW46ICh2KSAtPlxuXHRcdHR5cGVvZiB2IGlzIFwiYm9vbGVhblwiXG5cblxuXHQjIyMqXG5cdCAgUmV0dXJucyB0cmVlIGlmIG5vZGUgaXMgaXRlcmFibGVcblx0ICBAcmV0dXJuIHtCb29sZWFufVxuXHQjIyNcblx0aXNJdGVyYWJsZTogKGopIC0+XG5cdFx0aSA9IHR5cGVvZiBqXG5cdFx0ayA9IGZhbHNlXG5cdFx0aWYgaiBhbmQgaSBpc250IFwic3RyaW5nXCJcblx0XHRcdGlmIGkgaXMgXCJmdW5jdGlvblwiXG5cdFx0XHRcdGsgPSBqIGluc3RhbmNlb2YgTm9kZUxpc3Qgb3IgaiBpbnN0YW5jZW9mIEhUTUxDb2xsZWN0aW9uXG5cdFx0XHRlbHNlXG5cdFx0XHRcdGsgPSB0cnVlXG5cdFx0KGlmIGsgdGhlbiBqLmxlbmd0aCBpc250IGB1bmRlZmluZWRgIGVsc2UgZmFsc2UpXG5cblxuXHQjIyMqXG5cdCAgUmV0dXJucyB0cnVlIGlmIHRoZSBwYXNzZWQgdmFsdWUgaXMgYSBmdW5jdGlvbi5cblx0ICBAcGFyYW0ge01peGVkfSBmIFRoZSB2YWx1ZSB0byB0ZXN0XG5cdCAgQHJldHVybiB7Qm9vbGVhbn1cblx0IyMjXG5cdGlzRnVjbnRpb246IChmKSAtPlxuXHRcdHR5cGVvZiBmIGlzIFwiZnVuY3Rpb25cIlxuXG5cblx0aXNJbnN0YW5jZTogKG8pIC0+XG5cdFx0cmV0dXJuIEBpc09iamVjdChvKSAmJiBvLmNvbnN0cnVjdG9yLm5hbWUgIT0gJ09iamVjdCdcblxuXG5PYmplY3QuZXhwYW5kID0gKG9yaWdpbmFsLCBhcmdzLi4uKSAtPlxuXHRmb3Igb2JqIGluIGFyZ3Ncblx0XHRpZiAhb2JqIHRoZW4gY29udGludWU7XG5cdFx0Zm9yIGtleSx2YWwgb2Ygb2JqXG5cdFx0XHRpZiBvcmlnaW5hbFtrZXldIGlzIHVuZGVmaW5lZCB8fCBvcmlnaW5hbFtrZXldIGlzIG51bGxcblx0XHRcdFx0b3JpZ2luYWxba2V5XSA9IG9ialtrZXldXG5cdHJldHVybiBvcmlnaW5hbFxuXG5cbkFycmF5LmltcGxlbWVudCh7XG5cblx0aW5zZXJ0OiAoaW5kZXgsIGl0ZW0pIC0+XG5cdFx0QHNwbGljZShpbmRleCwgMCwgaXRlbSlcblx0XHRyZXR1cm5cblxuXHRkZXN0cm95OiAoKSAtPlxuXHRcdGZvciBpdGVtIGluIHRoaXMgdGhlbiBpZiBpdGVtLmRlc3Ryb3kgdGhlbiBpdGVtLmRlc3Ryb3koKVxuXHRcdHJldHVyblxuXG59KTtcblxuXG4jIyMqXG5zY3JpcHQ6IGFycmF5LXNvcnRieS5qc1xudmVyc2lvbjogMS4zLjBcbmRlc2NyaXB0aW9uOiBBcnJheS5zb3J0QnkgaXMgYSBwcm90b3R5cGUgZnVuY3Rpb24gdG8gc29ydCBhcnJheXMgb2Ygb2JqZWN0cyBieSBhIGdpdmVuIGtleS5cbmxpY2Vuc2U6IE1JVC1zdHlsZVxuZG93bmxvYWQ6IGh0dHA6Ly9tb290b29scy5uZXQvZm9yZ2UvcC9hcnJheV9zb3J0YnlcbnNvdXJjZTogaHR0cDovL2dpdGh1Yi5jb20vZW5la28vQXJyYXkuc29ydEJ5XG4jIyNcbigtPlxuXHRrZXlQYXRocyA9IFtdXG5cdHNhdmVLZXlQYXRoID0gKHBhdGgpIC0+XG5cdFx0a2V5UGF0aHMucHVzaFxuXHRcdFx0c2lnbjogKGlmIChwYXRoWzBdIGlzIFwiK1wiIG9yIHBhdGhbMF0gaXMgXCItXCIpIHRoZW4gcGFyc2VJbnQocGF0aC5zaGlmdCgpICsgMSwgMCkgZWxzZSAxKVxuXHRcdFx0cGF0aDogcGF0aFxuXHRcdHJldHVyblxuXG5cblx0dmFsdWVPZiA9IChvYmplY3QsIHBhdGgpIC0+XG5cdFx0cHRyID0gb2JqZWN0XG5cdFx0Zm9yIHAgaW4gcGF0aCB0aGVuIHB0ciA9IHB0cltwXVxuXHRcdHJldHVybiBwdHJcblxuXG5cdGNvbXBhcmVyID0gKGEsIGIpIC0+XG5cdFx0Zm9yIGl0ZW0gaW4ga2V5UGF0aHNcblx0XHRcdGFWYWwgPSB2YWx1ZU9mKGEsIGl0ZW0ucGF0aClcblx0XHRcdGJWYWwgPSB2YWx1ZU9mKGIsIGl0ZW0ucGF0aClcblx0XHRcdGlmIGFWYWwgPiBiVmFsIHRoZW4gcmV0dXJuIGl0ZW0uc2lnblxuXHRcdFx0aWYgYVZhbCA8IGJWYWwgdGhlbiByZXR1cm4gLWl0ZW0uc2lnblxuXHRcdHJldHVyblxuXG5cdEFycmF5LmltcGxlbWVudCBcInNvcnRCeVwiLCAoYXJncy4uLiktPlxuXHRcdGtleVBhdGhzLmVtcHR5KClcblx0XHRmb3IgYXJnIGluIGFyZ3Ncblx0XHRcdGlmIHR5cGVPZihhcmcpIGlzICdhcnJheSdcblx0XHRcdFx0c2F2ZUtleVBhdGgoYXJnKVxuXHRcdFx0ZWxzZVxuXHRcdFx0XHRzYXZlS2V5UGF0aChhcmcubWF0Y2goL1srLV18W14uXSsvZykpXG5cdFx0cmV0dXJuIEBzb3J0KGNvbXBhcmVyKVxuXG5cdHJldHVyblxuKSgpIiwibW9kdWxlLmV4cG9ydHMgPVxuXHRFdmVudHM6IHJlcXVpcmUgJy4vRXZlbnRzJ1xuXHRPYmplY3Q6IHJlcXVpcmUgJy4vT2JqZWN0JyIsImNsYXNzIERpSGVscGVyXG5cblx0ZXhwYW5kUmU6IC9ePCUoW1xcU10rKSU+JC9cblx0ZXhwYW5kU3RyaW5nUmU6IC88JShbXFxTXSspJT4vZ1xuXHRzZXJ2aWNlUmU6IC9eQChbXjpdKykoOihbXlxcKF0rKShcXCgoLiopXFwpKT8pPyQvXG5cdGNvZGVSZTogL14oXFwkKT8oW15cXChdKylcXCgoLiopXFwpJC9cblxuXG5cdGV4cGFuZDogKHBhcmFtLCBpbmplY3RvcikgLT5cblx0XHRpZiBUeXBlLmlzU3RyaW5nKHBhcmFtKVxuXHRcdFx0aWYgKG1hdGNoZXMgPSBwYXJhbS5tYXRjaChAZXhwYW5kUmUpKVxuXHRcdFx0XHRwYXJhbSA9IEBleHBhbmQoQGdldFNlY3Rpb24oaW5qZWN0b3IucGFyYW1zLCBtYXRjaGVzWzFdKSwgaW5qZWN0b3IpXG5cblx0XHRcdGVsc2UgaWYgKG1hdGNoZXMgPSBwYXJhbS5tYXRjaChAZXhwYW5kU3RyaW5nUmUpKVxuXHRcdFx0XHRmb3IgbWF0Y2ggaW4gbWF0Y2hlc1xuXHRcdFx0XHRcdHBhcmFtID0gcGFyYW0ucmVwbGFjZShtYXRjaCwgQGV4cGFuZChtYXRjaCwgaW5qZWN0b3IpKVxuXG5cdFx0ZWxzZSBpZiBUeXBlLmlzT2JqZWN0KHBhcmFtKVxuXHRcdFx0Zm9yIG5hbWUsdmFsdWUgb2YgcGFyYW1cblx0XHRcdFx0cGFyYW1bbmFtZV0gPSBAZXhwYW5kKHZhbHVlLCBpbmplY3RvcilcblxuXHRcdCMgbm90aGluZyB0byBleHBhbmQsIGp1c3QgcmV0dXJuIHZhbHVlXG5cdFx0cmV0dXJuIHBhcmFtXG5cblxuXHRldmFsdWF0ZUNvZGU6IChzZXJ2aWNlLCBjb2RlLCBpbmplY3RvcikgLT5cblx0XHRpZiBUeXBlLmlzQXJyYXkoY29kZSlcblx0XHRcdHZhbHVlcyA9IGNvZGVcblx0XHRcdGNvZGUgPSB2YWx1ZXMuc2hpZnQoKVxuXHRcdFx0ZXh0cmFBcmdzID0gQGV2YWx1YXRlQXJncyh2YWx1ZXMsIGluamVjdG9yKVxuXG5cdFx0aWYgKG1hdGNoZXMgPSBjb2RlLm1hdGNoKEBjb2RlUmUpKVxuXHRcdFx0aXNQcm9wZXJ0eSA9IG1hdGNoZXNbMV1cblx0XHRcdG9wZXJhdGlvbiA9IG1hdGNoZXNbMl1cblx0XHRcdGFyZ3MgPSBtYXRjaGVzWzNdXG5cdFx0XHRldmFsQXJncyA9IGlmIGFyZ3MgdGhlbiBAZXZhbHVhdGVBcmdzKGFyZ3MsIGluamVjdG9yKSBlbHNlIFtdXG5cdFx0XHRmb3IgYXJnLGluZGV4IGluIGV2YWxBcmdzXG5cdFx0XHRcdGlmIGFyZyBpcyAnPycgYW5kIGV4dHJhQXJncy5sZW5ndGg+MFxuXHRcdFx0XHRcdGV2YWxBcmdzW2luZGV4XSA9IGV4dHJhQXJncy5zaGlmdCgpXG5cdFx0XHRpZiBpc1Byb3BlcnR5XG5cdFx0XHRcdHNlcnZpY2Vbb3BlcmF0aW9uXSA9IGV2YWxBcmdzWzBdXG5cdFx0XHRlbHNlXG5cdFx0XHRcdGlmICFzZXJ2aWNlW29wZXJhdGlvbl1cblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJDYW50IGNhbGwgbWV0aG9kICcje29wZXJhdGlvbn0nIGluIHNlcnZpY2UgJyN7c2VydmljZS5jb25zdHJ1Y3Rvci5uYW1lfScuIE1ldGhvZCBpcyBub3QgZGVmaW5lZFwiKVxuXHRcdFx0XHRzZXJ2aWNlW29wZXJhdGlvbl0uYXBwbHkoc2VydmljZSwgZXZhbEFyZ3MpXG5cdFx0cmV0dXJuXG5cblxuXHRldmFsdWF0ZUFyZ3M6IChhcmdzLCBpbmplY3RvcikgLT5cblx0XHRyZXN1bHQgPSBbXVxuXHRcdGlmIFR5cGUuaXNTdHJpbmcoYXJncylcblx0XHRcdGFyZ3MgPSBhcmdzLnNwbGl0KCcsJylcblx0XHRmb3IgYXJnIGluIGFyZ3Ncblx0XHRcdGlmICFUeXBlLmlzU3RyaW5nKGFyZylcblx0XHRcdFx0cmVzdWx0LnB1c2goYXJnKVxuXHRcdFx0XHRjb250aW51ZVxuXG5cdFx0XHR2YWx1ZSA9IEBleHBhbmQoYXJnLCBpbmplY3Rvcilcblx0XHRcdGlmICFUeXBlLmlzU3RyaW5nKHZhbHVlKVxuXHRcdFx0XHRyZXN1bHQucHVzaCh2YWx1ZSlcblx0XHRcdFx0Y29udGludWVcblxuXHRcdFx0IyBjYW4gYnkgZXhwYW5kZWQgdG8gb2JqZWN0IG5lZWQgdGVzdCBhZ2FpblxuXHRcdFx0bWF0Y2hlcyA9IHZhbHVlLm1hdGNoKEBzZXJ2aWNlUmUpXG5cdFx0XHRpZiAhbWF0Y2hlc1xuXHRcdFx0XHRyZXN1bHQucHVzaCh2YWx1ZSlcblx0XHRcdFx0Y29udGludWVcblxuXHRcdFx0bmFtZSA9IG1hdGNoZXNbMV1cblx0XHRcdG9wID0gbWF0Y2hlc1szXSB8fCBudWxsXG5cdFx0XHRvcENhbGwgPSBtYXRjaGVzWzRdIHx8IG51bGxcblx0XHRcdG9wQXJncyA9IG1hdGNoZXNbNV0gfHwgbnVsbFxuXHRcdFx0aW5zdGFuY2UgPSBpbmplY3Rvci5nZXQobmFtZSlcblxuXHRcdFx0aWYgIW9wXG5cdFx0XHRcdHJlc3VsdC5wdXNoKGluc3RhbmNlKVxuXHRcdFx0ZWxzZVxuXHRcdFx0XHRpZiAhaW5zdGFuY2Vbb3BdXG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiQ2FudCBjYWxsIG1ldGhvZCAje29wfSBpbiBzZXJ2aWNlICN7bmFtZX0gb2YgI3tpbnN0YW5jZS5jb25zdHJ1Y3Rvci5uYW1lfS4gTWV0aG9kIGlzIG5vdCBkZWZpbmVkXCIpXG5cdFx0XHRcdGlmICFvcENhbGxcblx0XHRcdFx0XHRyZXN1bHQucHVzaCAoKT0+IGluc3RhbmNlW29wXS5jYWxsKGluc3RhbmNlKVxuXHRcdFx0XHRlbHNlIGlmICFhcmdzXG5cdFx0XHRcdFx0cmVzdWx0LnB1c2goaW5zdGFuY2Vbb3BdLmNhbGwoaW5zdGFuY2UpKVxuXHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0cmVzdWx0LnB1c2goaW5zdGFuY2Vbb3BdLmFwcGx5KGluc3RhbmNlLCBAZXZhbHVhdGVBcmdzKG9wQXJncywgaW5qZWN0b3IpKSlcblxuXHRcdHJldHVybiByZXN1bHRcblxuXG5cdGdldFNlY3Rpb246IChjb25maWcsIHNlY3Rpb24pIC0+XG5cdFx0cG9zID0gc2VjdGlvbi5pbmRleE9mKCcuJylcblx0XHRpZiBwb3MgPiAwXG5cdFx0XHRzZWN0aW9uID0gQGdldFNlY3Rpb24oY29uZmlnW3NlY3Rpb24uc3Vic3RyKDAsIHBvcyldLCBzZWN0aW9uLnN1YnN0cihwb3MrMSkpXG5cdFx0ZWxzZSBpZiBjb25maWcgJiYgY29uZmlnW3NlY3Rpb25dIGlzbnQgdW5kZWZpbmVkXG5cdFx0XHRzZWN0aW9uID0gY29uZmlnW3NlY3Rpb25dXG5cdFx0ZWxzZVxuXHRcdFx0c2VjdGlvbiA9IG51bGxcblx0XHRyZXR1cm4gc2VjdGlvblxuXG5cblxubW9kdWxlLmV4cG9ydHMgPSBuZXcgRGlIZWxwZXIiLCJTZXJ2aWNlID0gcmVxdWlyZSAnLi9TZXJ2aWNlJ1xuRGlIZWxwZXIgPSByZXF1aXJlICcuL0RpSGVscGVyJ1xuXG5cbmNsYXNzIEluamVjdG9yXG5cblx0cGFyYW1zOiBudWxsXG5cdGRlZmluZXM6IG51bGxcblx0c2VydmljZXM6IG51bGxcblx0Z2xvYmFsczogbnVsbFxuXG5cdGNvbnN0cnVjdG9yOiAoQHBhcmFtcyA9IHt9KSAtPlxuXHRcdEBkZWZpbmVzID0ge31cblx0XHRAc2VydmljZXMgPSB7fVxuXHRcdEBnbG9iYWxzID0ge31cblx0XHRAc2V0KCdpbmplY3RvcicsIHRoaXMpXG5cdFx0aWYgIUBwYXJhbXMubmFtZXNwYWNlIHRoZW4gQHBhcmFtcy5uYW1lc3BhY2UgPSAnQXBwJ1xuXG5cblx0ZGVmaW5lOiAobmFtZSwga2xhc3MsIGNiID0gbnVsbCkgLT5cblx0XHRpZiBAc2VydmljZXNbbmFtZV0gfHwgQGRlZmluZXNbbmFtZV1cblx0XHRcdHRocm93IG5ldyBFcnJvcihcIlNlcnZpY2UgI3tuYW1lfSBhbHJlYWR5IGV4aXN0c1wiKVxuXHRcdHNlcnZpY2UgPSBuZXcgU2VydmljZSh0aGlzLCBuYW1lLCBrbGFzcywgY2IpXG5cdFx0QGRlZmluZXNbbmFtZV0gPSBzZXJ2aWNlXG5cdFx0cmV0dXJuIEBkZWZpbmVzW25hbWVdXG5cblxuXHRnZXQ6IChuYW1lKSAtPlxuXHRcdGlmICFAc2VydmljZXNbbmFtZV0gJiYgIUBkZWZpbmVzW25hbWVdXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJTZXJ2aWNlIHdpdGggbmFtZSAje25hbWV9IG5vdCBmb3VuZFwiKVxuXHRcdGlmICFAc2VydmljZXNbbmFtZV0gIyBtdXN0IGJ5IGRlZmluZWRcblx0XHRcdEBzZXJ2aWNlc1tuYW1lXSA9IEBkZWZpbmVzW25hbWVdLmNyZWF0ZSgpXG5cdFx0cmV0dXJuIEBzZXJ2aWNlc1tuYW1lXVxuXG5cblx0dXBkYXRlOiAobmFtZSkgLT5cblx0XHRpZiAhQGRlZmluZXNbbmFtZV1cblx0XHRcdHRocm93IG5ldyBFcnJvcihcIlNlcnZpY2Ugd2l0aCBuYW1lICN7bmFtZX0gbm90IGZvdW5kXCIpXG5cdFx0cmV0dXJuIEBkZWZpbmVzW25hbWVdXG5cblxuXHRzZXQ6IChuYW1lLCBzZXJ2aWNlKSAtPlxuXHRcdGlmIEBzZXJ2aWNlc1tuYW1lXSB8fCBAZGVmaW5lc1tuYW1lXVxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiU2VydmljZSAje25hbWV9IGFscmVhZHkgZXhpc3RzXCIpXG5cdFx0QHNlcnZpY2VzW25hbWVdID0gc2VydmljZVxuXHRcdHJldHVybiB0aGlzXG5cblxuXHRoYXM6IChuYW1lKSAtPlxuXHRcdHJldHVybiBAc2VydmljZXNbbmFtZV0gfHwgQGRlZmluZXNbbmFtZV1cblxuXG5cdHNldEdsb2JhbDogKG5hbWUsIHNlcnZpY2UpIC0+XG5cdFx0QGdsb2JhbHNbbmFtZV0gPSBzZXJ2aWNlXG5cdFx0cmV0dXJuIHRoaXNcblxuXG5cdGlzRGVmaW5lZDogKG5hbWUpIC0+XG5cdFx0cmV0dXJuIEBkZWZpbmVzW25hbWVdIGlzbnQgdW5kZWZpbmVkXG5cblxuXHRjcmVhdGU6IChuYW1lKSAtPlxuXHRcdGlmICFAZGVmaW5lc1tuYW1lXVxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiU2VydmljZSB3aXRoIG5hbWUgI3tuYW1lfSBub3QgZGVmaW5lZFwiKVxuXHRcdHJldHVybiBAZGVmaW5lc1tuYW1lXS5jcmVhdGUoKVxuXG5cblx0Y3JlYXRlSW5zdGFuY2U6IChrbGFzcywgb3B0aW9ucyA9IHt9LCBmYWN0b3J5ID0gbnVsbCkgLT5cblx0XHQjIGV2YWx1YXRlIG9wdGlvbnNcblx0XHRmb3IgbmFtZSx2YWx1ZSBvZiBvcHRpb25zXG5cdFx0XHRvcHRpb25zW25hbWVdID0gRGlIZWxwZXIuZXZhbHVhdGVBcmdzKHZhbHVlLCB0aGlzKVswXVxuXG5cdFx0IyBwcm9wZXJ0eS9zZXR0ZXIgaW5qZWN0aW9uXG5cdFx0aWYga2xhc3MucHJvdG90eXBlLmluamVjdHNcblx0XHRcdGZvciBwcm9wTmFtZSxzZXJ2aWNlTmFtZSBvZiBrbGFzcy5wcm90b3R5cGUuaW5qZWN0c1xuXHRcdFx0XHRvcHRpb25zW3Byb3BOYW1lXSA9IEBnZXQoc2VydmljZU5hbWUpXG5cblx0XHQjIGNyZWF0ZSBpbnN0YW5jZVxuXHRcdGlmIGZhY3Rvcnlcblx0XHRcdGlmIFR5cGUuaXNTdHJpbmcoZmFjdG9yeSlcblx0XHRcdFx0ZmFjdG9yeSA9IERpSGVscGVyLmV2YWx1YXRlQXJncyhmYWN0b3J5LCB0aGlzKVswXVxuXHRcdFx0aWYgVHlwZS5pc0Z1bmN0aW9uKGZhY3RvcnkpXG5cdFx0XHRcdGluc3RhbmNlID0gZmFjdG9yeShvcHRpb25zKVxuXHRcdGVsc2Vcblx0XHRcdGluc3RhbmNlID0gbmV3IGtsYXNzKG9wdGlvbnMpXG5cblx0XHQjIHZhbGlkYXRlIGluc3RhbmNlXG5cdFx0aWYgaW5zdGFuY2UgIWluc3RhbmNlb2Yga2xhc3Ncblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkNyZWF0ZWQgc2VydmljZSBpcyBub3QgaW5zdGFuY2Ugb2YgZGVzaXJlZCB0eXBlICN7a2xhc3MubmFtZX0sIGJ1dCBpbnN0YW5jZSBvZiAje2luc3RhbmNlLmNvbnN0cnVjdG9yLm5hbWV9XCIpXG5cblx0XHQjIHJldHVybiBpbnN0YW5jZVxuXHRcdHJldHVybiBpbnN0YW5jZVxuXG5cblxubW9kdWxlLmV4cG9ydHMgPSBJbmplY3RvciIsIkRpSGVscGVyID0gcmVxdWlyZSAnLi9EaUhlbHBlcidcblxuY2xhc3MgSW5qZWN0b3JFeHRlbnNpb25cblxuXHRjb25maWc6IG51bGxcblx0aW5qZWN0b3I6IG51bGxcblxuXG5cdGNvbnN0cnVjdG9yOiAoKSAtPlxuXHRcdEBjb25maWcgPSB7fVxuXG5cblx0aW5pdDogKCkgLT5cblx0XHRyZXR1cm5cblxuXG5cdHNldENvbmZpZzogKGNvbmZpZykgLT5cblx0XHRPYmplY3QubWVyZ2UoQGNvbmZpZywgRGlIZWxwZXIuZXhwYW5kKGNvbmZpZywgQGluamVjdG9yKSlcblx0XHRyZXR1cm5cblxuXG5tb2R1bGUuZXhwb3J0cyA9IEluamVjdG9yRXh0ZW5zaW9uIiwiSW5qZWN0b3IgPSByZXF1aXJlICcuL0luamVjdG9yJ1xuRGlIZWxwZXIgPSByZXF1aXJlICcuL0RpSGVscGVyJ1xuXG5cbmNsYXNzIEluamVjdG9yRmFjdG9yeVxuXG5cdGNvbmZpZzogbnVsbFxuXHRleHRlbnNpb25zOiBudWxsXG5cblxuXHRjb25zdHJ1Y3RvcjogKCkgLT5cblx0XHRAY29uZmlnID1cblx0XHRcdHBhcmFtczpcblx0XHRcdFx0YmFzZVVybDogJydcblx0XHRAZXh0ZW5zaW9ucyA9IHt9XG5cblxuXHRzZXRFeHRlbnNpb246IChuYW1lLCBleHRlbnNpb24pIC0+XG5cdFx0QGV4dGVuc2lvbnNbbmFtZV0gPSBleHRlbnNpb25cblx0XHRyZXR1cm5cblxuXG5cdHNldENvbmZpZzogKGNvbmZpZykgLT5cblx0XHRPYmplY3QubWVyZ2UoQGNvbmZpZywgY29uZmlnKVxuXHRcdHJldHVyblxuXG5cblx0Y3JlYXRlSW5qZWN0b3I6ICgpIC0+XG5cdFx0aW5qZWN0b3IgPSBuZXcgSW5qZWN0b3IoQGNvbmZpZy5wYXJhbXMpXG5cdFx0RGlIZWxwZXIuZXhwYW5kKGluamVjdG9yLnBhcmFtcywgaW5qZWN0b3IpXG5cblx0XHRmb3IgbmFtZSxleHRlbnNpb24gb2YgQGNvbmZpZy5leHRlbnNpb25zXG5cdFx0XHRAc2V0RXh0ZW5zaW9uKG5hbWUsIG5ldyBleHRlbnNpb24oKSlcblxuXHRcdGZvciBuYW1lLGV4dCBvZiBAZXh0ZW5zaW9uc1xuXHRcdFx0ZXh0LmluamVjdG9yID0gaW5qZWN0b3Jcblx0XHRcdGV4dC5pbml0KClcblxuXHRcdGZvciBuYW1lLGV4dCBvZiBAZXh0ZW5zaW9uc1xuXHRcdFx0ZXh0LnNldENvbmZpZyhAY29uZmlnW25hbWVdLCBpbmplY3RvcikgaWYgQGNvbmZpZ1tuYW1lXVxuXG5cdFx0Zm9yIG5hbWUsZXh0IG9mIEBleHRlbnNpb25zXG5cdFx0XHRleHQuYnVpbGQoaW5qZWN0b3IpICBpZiBleHQuYnVpbGRcblxuXHRcdGlmIEBjb25maWcuc2VydmljZXMgdGhlbiBmb3IgbmFtZSxzZXJ2aWNlIG9mIEBjb25maWcuc2VydmljZXNcblx0XHRcdGlmICFpbmplY3Rvci5pc0RlZmluZWQobmFtZSlcblx0XHRcdFx0ZGVmaW5pdGlvbiA9IGluamVjdG9yLmRlZmluZShuYW1lLCBzZXJ2aWNlLnR5cGUpXG5cdFx0XHRlbHNlXG5cdFx0XHRcdGRlZmluaXRpb24gPSBpbmplY3Rvci51cGRhdGUobmFtZSlcblx0XHRcdGlmIHNlcnZpY2UuZmFjdG9yeVxuXHRcdFx0XHRkZWZpbml0aW9uLnNldEZhY3Rvcnkoc2VydmljZS5mYWN0b3J5KVxuXHRcdFx0aWYgc2VydmljZS5zZXR1cFxuXHRcdFx0XHRkZWZpbml0aW9uLnNldHVwKHNlcnZpY2Uuc2V0dXApXG5cdFx0XHRpZiBzZXJ2aWNlLm9wdGlvbnNcblx0XHRcdFx0ZGVmaW5pdGlvbi5vcHRpb24oc2VydmljZS5vcHRpb25zKVxuXHRcdFx0aWYgc2VydmljZS5nbG9iYWxcblx0XHRcdFx0ZGVmaW5pdGlvbi5zZXRHbG9iYWwobmFtZSlcblxuXHRcdGZvciBuYW1lLGV4dCBvZiBAZXh0ZW5zaW9uc1xuXHRcdFx0ZXh0LnVwZGF0ZShpbmplY3RvcikgIGlmIGV4dC51cGRhdGVcblxuXHRcdHJldHVybiBpbmplY3RvclxuXG5cbm1vZHVsZS5leHBvcnRzID0gSW5qZWN0b3JGYWN0b3J5IiwiRGlIZWxwZXIgPSByZXF1aXJlICcuL0RpSGVscGVyJ1xuXG5cbmNsYXNzIFNlcnZpY2VcblxuXHRpbmplY3RvcjogbnVsbFxuXHRuYW1lOiBudWxsXG5cdGtsYXNzOiBudWxsXG5cdHNldHVwczogbnVsbFxuXHRvcHRpb25zOiBudWxsXG5cdGZhY3Rvcnk6IG51bGxcblx0Z2xvYmFsOiBmYWxzZVxuXG5cblx0Y29uc3RydWN0b3I6IChAaW5qZWN0b3IsIEBuYW1lLCBAa2xhc3MsIG9uQ3JlYXRlID0gbnVsbCkgLT5cblx0XHRAc2V0dXBzID0gW11cblx0XHRAb3B0aW9ucyA9IHt9XG5cdFx0QHNldHVwcy5wdXNoKG9uQ3JlYXRlKSBpZiBvbkNyZWF0ZVxuXG5cblx0Y3JlYXRlOiAtPlxuXHRcdGluc3RhbmNlID0gQGluamVjdG9yLmNyZWF0ZUluc3RhbmNlKEBrbGFzcywgQG9wdGlvbnMsIEBmYWN0b3J5KVxuXHRcdGZvciBzZXR1cCBpbiBAc2V0dXBzXG5cdFx0XHRzZXR1cChpbnN0YW5jZSwgQGluamVjdG9yKVxuXHRcdHJldHVybiBpbnN0YW5jZVxuXG5cblx0c2V0Q2xhc3M6IChAa2xhc3MpIC0+XG5cdFx0cmV0dXJuIHRoaXNcblxuXG5cdHNldEZhY3Rvcnk6IChAZmFjdG9yeSkgLT5cblx0XHRyZXR1cm4gdGhpc1xuXG5cblx0c2V0R2xvYmFsOiAobmFtZSA9IG51bGwpIC0+XG5cdFx0QGluamVjdG9yLnNldEdsb2JhbChuYW1lfHxAbmFtZSwgQG5hbWUpXG5cdFx0cmV0dXJuIHRoaXNcblxuXG5cdHNldHVwOiAoY29uZmlnKSAtPlxuXHRcdGlmIFR5cGUuaXNGdW5jdGlvbihjb25maWcpXG5cdFx0XHRAc2V0dXBzLnB1c2goY29uZmlnKVxuXHRcdGVsc2UgaWYgVHlwZS5pc0FycmF5KGNvbmZpZylcblx0XHRcdEBzZXR1cHMucHVzaChAY3JlYXRlU2V0dXAoY29uZmlnKSlcblx0XHRlbHNlXG5cdFx0XHRAc2V0dXBzLnB1c2goQGNyZWF0ZVNldHVwKEFycmF5LmZyb20oYXJndW1lbnRzKSkpXG5cdFx0cmV0dXJuIHRoaXNcblxuXG5cdG9wdGlvbjogKG5hbWUsIHZhbHVlKSAtPlxuXHRcdGlmIFR5cGUuaXNTdHJpbmcobmFtZSlcblx0XHRcdGlmIHZhbHVlIGlzbnQgdW5kZWZpbmVkXG5cdFx0XHRcdEBvcHRpb25zW25hbWVdID0gdmFsdWVcblx0XHRcdGVsc2Vcblx0XHRcdFx0ZGVsZXRlIEBvcHRpb25zW25hbWVdXG5cdFx0ZWxzZSBpZiBUeXBlLmlzT2JqZWN0KG5hbWUpXG5cdFx0XHRmb3Igayx2IG9mIG5hbWVcblx0XHRcdFx0QG9wdGlvbihrLHYpXG5cdFx0cmV0dXJuIHRoaXNcblxuXG5cdGNyZWF0ZVNldHVwOiAoY29uZmlnKSAtPlxuXHRcdHJldHVybiAoc2VydmljZSwgaW5qZWN0b3IpID0+XG5cdFx0XHRmb3IgdmFsdWUgaW4gY29uZmlnXG5cdFx0XHRcdERpSGVscGVyLmV2YWx1YXRlQ29kZShzZXJ2aWNlLCB2YWx1ZSwgaW5qZWN0b3IpXG5cdFx0XHRyZXR1cm5cblxuXG5cbm1vZHVsZS5leHBvcnRzID0gU2VydmljZSIsIm1vZHVsZS5leHBvcnRzID1cblxuXHRJbmplY3RvcjogcmVxdWlyZSgnLi9JbmplY3RvcicpXG5cdEluamVjdG9yRmFjdG9yeTogcmVxdWlyZSgnLi9JbmplY3RvckZhY3RvcnknKVxuXHRJbmplY3RvckV4dGVuc2lvbjogcmVxdWlyZSgnLi9JbmplY3RvckV4dGVuc2lvbicpXG4iLCJDb29raWVTZWN0aW9uID0gcmVxdWlyZSAnLi9Db29raWVTZWN0aW9uJ1xuXG5cbmNsYXNzIENvb2tpZU1hbmFnZXJcblxuXHRkb2N1bWVudDogbnVsbFxuXHRvcHRpb25zOiBudWxsXG5cblxuXHRjb25zdHJ1Y3RvcjogKG9wdGlvbnMgPSB7fSkgLT5cblx0XHRAb3B0aW9ucyA9IG9wdGlvbnNcblx0XHRAZG9jdW1lbnQgPSBkb2N1bWVudFxuXHRcdHJldHVyblxuXG5cblx0c2V0OiAoa2V5LCB2YWx1ZSwgb3B0aW9ucykgLT5cblx0XHRAY3JlYXRlKGtleSwgb3B0aW9ucykud3JpdGUodmFsdWUpXG5cdFx0cmV0dXJuIHRoaXNcblxuXG5cdGdldDogKGtleSwgZGVmKSAtPlxuXHRcdHJldHVybiBAY3JlYXRlKGtleSkucmVhZCgpIHx8IGRlZlxuXG5cblx0cmVtb3ZlOiAoa2V5LCBvcHRpb25zKSAtPlxuXHRcdEBzZXQoa2V5LCBudWxsLCBPYmplY3QubWVyZ2Uoe2R1cmF0aW9uOiAtMX0sIG9wdGlvbnMpKVxuXHRcdHJldHVybiB0aGlzXG5cblxuXHRjcmVhdGU6IChrZXksIG9wdGlvbnMpIC0+XG5cdFx0Y29va2llID0gbmV3IENvb2tpZShrZXksIE9iamVjdC5tZXJnZSh7fSwgQG9wdGlvbnMsIG9wdGlvbnMpKVxuXHRcdGNvb2tpZS5vcHRpb25zLmRvY3VtZW50ID0gQGRvY3VtZW50XG5cdFx0cmV0dXJuIGNvb2tpZVxuXG5cblx0c2VjdGlvbjogKG5hbWUsIG9wdGlvbnMpIC0+XG5cdFx0cmV0dXJuIG5ldyBDb29raWVTZWN0aW9uKHRoaXMsIG5hbWUsIG9wdGlvbnMpXG5cblxubW9kdWxlLmV4cG9ydHMgPSBDb29raWVNYW5hZ2VyIiwiY2xhc3MgQ29va2llU2VjdGlvblxuXG5cdGNvb2tpZTogbnVsbFxuXHRuYW1lOiBudWxsXG5cdG9wdGlvbnM6IG51bGxcblx0aXRlbXM6IG51bGxcblxuXG5cdGNvbnN0cnVjdG9yOiAoY29va2llLCBuYW1lLCBvcHRpb25zKSAtPlxuXHRcdEBjb29raWUgPSBjb29raWVcblx0XHRAbmFtZSA9IG5hbWVcblx0XHRAb3B0aW9ucyA9IG9wdGlvbnNcblx0XHRAaXRlbXMgPSBKU09OLmRlY29kZShjb29raWUuZ2V0KG5hbWUpIG9yIFwie31cIiwgdHJ1ZSlcblx0XHRyZXR1cm5cblxuXG5cdHNhdmU6IC0+XG5cdFx0dmFsdWUgPSBKU09OLmVuY29kZShAaXRlbXMpXG5cdFx0aWYgbm90IHZhbHVlIG9yIHZhbHVlLmxlbmd0aCA+IDQwOTZcblx0XHRcdHJldHVybiBmYWxzZSAjY29va2llIHdvdWxkIGJlIHRydW5jYXRlZCFcblx0XHRlbHNlXG5cdFx0XHRpZiB2YWx1ZSBpcyBcInt9XCJcblx0XHRcdFx0QGNvb2tpZS5yZW1vdmUoQG5hbWUpXG5cdFx0XHRlbHNlXG5cdFx0XHRcdEBjb29raWUuc2V0KEBuYW1lLCB2YWx1ZSwgQG9wdGlvbnMpXG5cdFx0XHRyZXR1cm4gdHJ1ZVxuXG5cblx0c2V0OiAobmFtZSwgdmFsdWUpIC0+XG5cdFx0aWYgdmFsdWUgaXMgbnVsbFxuXHRcdFx0ZGVsZXRlIEBpdGVtc1tuYW1lXVxuXHRcdGVsc2Vcblx0XHRcdEBpdGVtc1tuYW1lXSA9IHZhbHVlXG5cdFx0cmV0dXJuIHRoaXNcblxuXG5cdGdldDogKG5hbWUsIGRlZikgLT5cblx0XHRyZXR1cm4gKGlmIEBpdGVtcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSB0aGVuIEBpdGVtc1tuYW1lXSBlbHNlIGRlZilcblxuXG5cdGhhczogKG5hbWUpIC0+XG5cdFx0cmV0dXJuIEBpdGVtcy5oYXNPd25Qcm9wZXJ0eShuYW1lKVxuXG5cblx0ZWFjaDogKGNhbGxiYWNrKSAtPlxuXHRcdHJldHVybiBPYmplY3QuZWFjaChAaXRlbXMsIGNhbGxiYWNrKVxuXG5cbm1vZHVsZS5leHBvcnRzID0gQ29va2llU2VjdGlvbiIsImNsYXNzIEh0dHBSZXF1ZXN0IGV4dGVuZHMgUmVxdWVzdFxuXG5cdG1hbmFnZXI6IG51bGxcblxuXG5cdGNvbnN0cnVjdG9yOiAob3B0aW9ucyA9IHt9KSAtPlxuXHRcdG9wdGlvbnMudHlwZSA9IG9wdGlvbnMudHlwZSB8fCAnanNvbidcblx0XHRzdXBlcihPYmplY3QubWVyZ2Uob3B0aW9ucywge2RhdGE6IHt9fSkpXG5cdFx0QGluaXQoKVxuXHRcdHJldHVyblxuXG5cblx0aW5pdDogLT5cblx0XHRpZiBAb3B0aW9ucy50eXBlIGlzICdqc29uJ1xuXHRcdFx0QHNldEhlYWRlcignQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKVxuXHRcdFx0QHNldEhlYWRlcignWC1SZXF1ZXN0JywgJ0pTT04nKVxuXHRcdHJldHVyblxuXG5cblx0c3VjY2VzczogKHRleHQpIC0+XG5cdFx0aWYgQG9wdGlvbnMudHlwZSBpcyAnanNvbidcblx0XHRcdHRyeVxuXHRcdFx0XHRqc29uID0gSlNPTi5kZWNvZGUodGV4dCwgQG9wdGlvbnMuc2VjdXJlKVxuXHRcdFx0XHRAcmVzcG9uc2UuanNvbiA9IGpzb25cblx0XHRcdGNhdGNoIGVyclxuXHRcdFx0XHRAZW1pdChcImVycm9yXCIsIGVyciwgdGV4dCwgdGhpcy54aHIpXG5cdFx0XHRcdEBvbkZhaWx1cmUoKVxuXHRcdFx0XHRyZXR1cm5cblx0XHRcdEBvblN1Y2Nlc3MoanNvbiwgdGV4dClcblx0XHRlbHNlXG5cdFx0XHRAb25TdWNjZXNzKHRleHQpXG5cdFx0cmV0dXJuXG5cblxuXHRzZW5kOiAob3B0aW9ucyA9IHt9KSAtPlxuXHRcdGlmIEBtYW5hZ2VyXG5cdFx0XHRvcHRpb25zLmRhdGEgPSBPYmplY3QubWVyZ2Uoe30sIEBtYW5hZ2VyLnBhcmFtcywgb3B0aW9ucy5kYXRhIHx8IEBvcHRpb25zLmRhdGEpXG5cdFx0XHRzdXBlcihvcHRpb25zKVxuXHRcdGVsc2Vcblx0XHRcdG9wdGlvbnMuZGF0YSA9IE9iamVjdC5tZXJnZSh7fSwgb3B0aW9ucy5kYXRhIG9yIEBvcHRpb25zLmRhdGEpXG5cdFx0XHRzdXBlcihvcHRpb25zKVxuXHRcdHJldHVyblxuXG5cbm1vZHVsZS5leHBvcnRzID0gSHR0cFJlcXVlc3QiLCJNaXdvT2JqZWN0ID0gcmVxdWlyZSAnLi4vY29yZS9PYmplY3QnXG5IdHRwUmVxdWVzdCA9IHJlcXVpcmUgJy4vSHR0cFJlcXVlc3QnXG5cblxuY2xhc3MgSHR0cFJlcXVlc3RNYW5hZ2VyIGV4dGVuZHMgTWl3b09iamVjdFxuXG5cdCMgQHByb3BlcnR5IHtPYmplY3R9IHBlcnNpc3RlbnQgcGFyYW1zXG5cdHBhcmFtczogbnVsbFxuXG5cdCMgQHByb3BlcnR5IHtBcnJheX0gcmVnaXN0ZXJlZCBwbHVnaW5zXG5cdHBsdWdpbnM6IG51bGxcblxuXHQjIEBldmVudCBzdWNjZXNzIChyZXEsIHBheWxvYWQpXG5cdCMgQGV2ZW50IGZhaWx1cmUgKHJlcSlcblx0IyBAZXZlbnQgZXJyb3IgKHJlcSwgZXJyKVxuXG5cblx0Y29uc3RydWN0b3I6IC0+XG5cdFx0c3VwZXIoKVxuXHRcdEBwYXJhbXMgPSB7fVxuXHRcdEBwbHVnaW5zID0gW11cblx0XHRAb24gJ3JlcXVlc3QnLCAocmVxKSA9PlxuXHRcdFx0Zm9yIHBsdWdpbiBpbiBAcGx1Z2luc1xuXHRcdFx0XHRwbHVnaW4ucmVxdWVzdChyZXEpIGlmIHBsdWdpbi5yZXF1ZXN0XG5cdFx0XHRyZXR1cm5cblx0XHRAb24gJ3N1Y2Nlc3MnLCAocmVxLCBwYXlsb2FkKSA9PlxuXHRcdFx0Zm9yIHBsdWdpbiBpbiBAcGx1Z2luc1xuXHRcdFx0XHRwbHVnaW4uc3VjY2VzcyhyZXEsIHBheWxvYWQpIGlmIHBsdWdpbi5zdWNjZXNzXG5cdFx0XHRyZXR1cm5cblx0XHRAb24gJ2ZhaWx1cmUnLCAocmVxKSA9PlxuXHRcdFx0Zm9yIHBsdWdpbiBpbiBAcGx1Z2luc1xuXHRcdFx0XHRwbHVnaW4uZmFpbHVyZShyZXEpIGlmIHBsdWdpbi5mYWlsdXJlXG5cdFx0XHRyZXR1cm5cblx0XHRAb24gJ2Vycm9yJywgKHJlcSkgPT5cblx0XHRcdGZvciBwbHVnaW4gaW4gQHBsdWdpbnNcblx0XHRcdFx0cGx1Z2luLmVycm9yKHJlcSkgaWYgcGx1Z2luLmVycm9yXG5cdFx0XHRyZXR1cm5cblx0XHRyZXR1cm5cblxuXG5cdCMjI1xuXHRcdFJlZ2lzdGVyIHBsdWdpblxuXHRcdEBwYXJhbSBwbHVnaW4ge09iamVjdH0gcGx1Z2luXG5cdCMjI1xuXHRwbHVnaW46IChwbHVnaW4pIC0+XG5cdFx0QHBsdWdpbnMucHVzaChwbHVnaW4pXG5cdFx0cmV0dXJuXG5cblxuXHQjIyNcblx0XHRDcmVhdGUgbWFuYWdlZCByZXF1ZXN0XG5cdFx0QHBhcmFtIG9wdGlvbnMge09iamVjdH1cblx0XHRAcmV0dXJuIHtNaXdvLmh0dHAuSHR0cFJlcXVlc3R9XG5cdCMjI1xuXHRjcmVhdGVSZXF1ZXN0OiAob3B0aW9ucykgLT5cblx0XHRyZXF1ZXN0ID0gbmV3IEh0dHBSZXF1ZXN0KG9wdGlvbnMpXG5cdFx0QG1hbmFnZShyZXF1ZXN0KVxuXHRcdHJldHVybiByZXF1ZXN0XG5cblxuXHRnZXQ6IChvcHRpb25zKSAtPlxuXHRcdHJlcXVlc3QgPSBAY3JlYXRlUmVxdWVzdChvcHRpb25zKVxuXHRcdHJlcXVlc3QuZ2V0KClcblx0XHRyZXR1cm4gcmVxdWVzdFxuXG5cblx0cG9zdDogKG9wdGlvbnMpIC0+XG5cdFx0cmVxdWVzdCA9IEBjcmVhdGVSZXF1ZXN0KG9wdGlvbnMpXG5cdFx0cmVxdWVzdC5wb3N0KClcblx0XHRyZXR1cm4gcmVxdWVzdFxuXG5cblx0cmVhZDogKHVybCkgLT5cblx0XHRkYXRhID0gbnVsbFxuXHRcdHJlcXVlc3QgPSBuZXcgUmVxdWVzdFxuXHRcdFx0dXJsOiB1cmxcblx0XHRcdGFzeW5jOiBmYWxzZVxuXHRcdFx0b25TdWNjZXNzOiAocmVzcG9uc2UpIC0+IGRhdGEgPSByZXNwb25zZVxuXHRcdFx0b25GYWlsdXJlOiAoeGhyKSAtPiBkYXRhID0gbnVsbFxuXHRcdHJlcXVlc3Quc2VuZCgpXG5cdFx0cmV0dXJuIGRhdGFcblxuXG5cdG1hbmFnZTogKHJlcSkgLT5cblx0XHRpZiAhcmVxLm1hbmFnZXJcblx0XHRcdHJlcS5tYW5hZ2VyID0gdGhpc1xuXHRcdFx0cmVxLm9uIFwicmVxdWVzdFwiLCA9PiBAZW1pdChcInJlcXVlc3RcIiwgcmVxKVxuXHRcdFx0cmVxLm9uIFwic3VjY2Vzc1wiLCAocGF5bG9hZCkgPT4gQGVtaXQoXCJzdWNjZXNzXCIsIHJlcSwgcGF5bG9hZClcblx0XHRcdHJlcS5vbiBcImZhaWx1cmVcIiwgPT4gQGVtaXQoXCJmYWlsdXJlXCIsIHJlcSlcblx0XHRcdHJlcS5vbiBcImVycm9yXCIsIChlcnIpID0+IEBlbWl0KFwiZXJyb3JcIiwgcmVxLCBlcnIpXG5cdFx0cmV0dXJuXG5cblxubW9kdWxlLmV4cG9ydHMgPSBIdHRwUmVxdWVzdE1hbmFnZXIiLCJtb2R1bGUuZXhwb3J0cyA9XG5cblx0SHR0cFJlcXVlc3Q6IHJlcXVpcmUgJy4vSHR0cFJlcXVlc3QnXG5cdEh0dHBSZXF1ZXN0TWFuYWdlcjogcmVxdWlyZSAnLi9IdHRwUmVxdWVzdE1hbmFnZXInXG5cdENvb2tpZVNlY3Rpb246IHJlcXVpcmUgJy4vQ29va2llU2VjdGlvbidcblx0Q29va2llTWFuYWdlcjogcmVxdWlyZSAnLi9Db29raWVNYW5hZ2VyJ1xuXHRwbHVnaW5zOiByZXF1aXJlICcuL3BsdWdpbnMnIiwiY2xhc3MgUmVkaXJlY3RQbHVnaW5cblxuXHRzdWNjZXNzOiAocmVxdWVzdCwgcGF5bG9hZCkgLT5cblx0XHRpZiByZXF1ZXN0LnR5cGUgaXNudCAnanNvbidcblx0XHRcdHJldHVyblxuXHRcdGlmIHBheWxvYWQucmVkaXJlY3Rcblx0XHRcdGRvY3VtZW50LmxvY2F0aW9uID0gcGF5bG9hZC5yZWRpcmVjdFxuXHRcdHJldHVyblxuXG5cblxuY2xhc3MgRmFpbHVyZVBsdWdpblxuXG5cdGZhaWx1cmU6IChyZXF1ZXN0KSAtPlxuXHRcdG1pd28uZmxhc2guZXJyb3IocmVxdWVzdC54aHIuc3RhdHVzVGV4dCArIFwiOiBcIiArIHJlcXVlc3QueGhyLnJlc3BvbnNlVGV4dC5yZXBsYWNlKC8oPChbXj5dKyk+KS9nLCBcIlwiKSlcblx0XHRyZXR1cm5cblxuXG5cbmNsYXNzIEVycm9yUGx1Z2luXG5cblx0ZXJyb3I6IChyZXF1ZXN0LCBlcnIpIC0+XG5cdFx0Y29uc29sZS5sb2coXCJFcnJvciBpbiBhamF4IHJlcXVlc3RcIiwgcmVxdWVzdCwgZXJyKVxuXHRcdHJldHVyblxuXG5cblxubW9kdWxlLmV4cG9ydHMgPVxuXG5cdFJlZGlyZWN0UGx1Z2luOiBSZWRpcmVjdFBsdWdpblxuXHRGYWlsdXJlUGx1Z2luOiBGYWlsdXJlUGx1Z2luXG5cdEVycm9yUGx1Z2luOiBFcnJvclBsdWdpbiIsInJlcXVpcmUgJy4vY29yZS9Db21tb24nXG5yZXF1aXJlICcuL2NvcmUvVHlwZXMnXG5yZXF1aXJlICcuL2NvcmUvRWxlbWVudCdcblxuIyBjcmVhdGUgbG9hZGVyXG5taXdvID0gcmVxdWlyZSAnLi9ib290c3RyYXAvTWl3bydcbmdsb2JhbC5taXdvID0gbWl3b1xuXG4jIGNyZWF0ZSBuYW1lc3BhY2Vcbk1pd28gPSB7fVxuZ2xvYmFsLk1pd28gPSBNaXdvXG5cbiMgcmVnaXN0ZXIgZGkgZXh0ZW5zaW9uXG5taXdvLnJlZ2lzdGVyRXh0ZW5zaW9uKCdtaXdvJywgcmVxdWlyZSAnLi9EaUV4dGVuc2lvbicpXG5cbiMgY29yZVxuTWl3by5jb3JlID0gcmVxdWlyZSAnLi9jb3JlJ1xuTWl3by5PYmplY3QgPSBNaXdvLmNvcmUuT2JqZWN0XG5NaXdvLkV2ZW50cyA9IE1pd28uY29yZS5FdmVudHNcblxuIyBjb21wb25lbnRzXG5NaXdvLmNvbXBvbmVudCA9IHJlcXVpcmUgJy4vY29tcG9uZW50J1xuTWl3by5Db21wb25lbnQgPSBNaXdvLmNvbXBvbmVudC5Db21wb25lbnRcbk1pd28uQ29udGFpbmVyID0gTWl3by5jb21wb25lbnQuQ29udGFpbmVyXG5cbiMgZGVwZW5kZW5jeSBpbmplY3Rpb25cbk1pd28uZGkgPSByZXF1aXJlICcuL2RpJ1xuXG4jIGh0dHBcbk1pd28uaHR0cCA9IHJlcXVpcmUgJy4vaHR0cCdcblxuIyB1dGlsc1xuTWl3by5sb2NhbGUgPSByZXF1aXJlICcuL2xvY2FsZSdcblxuIyB1dGlsc1xuTWl3by51dGlscyA9IHJlcXVpcmUgJy4vdXRpbHMnIiwiTGF5b3V0ID0gcmVxdWlyZSgnLi9MYXlvdXQnKVxuXG5cbmNsYXNzIEFic29sdXRlTGF5b3V0IGV4dGVuZHMgTGF5b3V0XG5cblxuXHRjb25zdHJ1Y3RvcjogKGNvbmZpZykgLT5cblx0XHRzdXBlcihjb25maWcpXG5cdFx0QHR5cGUgPSAnYWJzb2x1dGUnXG5cdFx0QHRhcmdldENscyA9ICdtaXdvLWxheW91dC1hYnNvbHV0ZSdcblx0XHRAaXRlbUNscyA9ICdtaXdvLWxheW91dC1pdGVtJ1xuXHRcdHJldHVyblxuXG5cblx0Y29uZmlndXJlQ29tcG9uZW50OiAoY29tcG9uZW50KSAtPlxuXHRcdHN1cGVyKGNvbXBvbmVudClcblx0XHRjb21wb25lbnQuZWwuc2V0U3R5bGVzXG5cdFx0XHR0b3A6IGNvbXBvbmVudC50b3Bcblx0XHRcdGJvdHRvbTogIGNvbXBvbmVudC5ib3R0b21cblx0XHRcdGxlZnQ6IGNvbXBvbmVudC5sZWZ0XG5cdFx0XHRyaWdodDogY29tcG9uZW50LnJpZ2h0XG5cdFx0cmV0dXJuXG5cblxuXHR1bmNvbmZpZ3VyZUNvbXBvbmVudDogKGNvbXBvbmVudCkgLT5cblx0XHRzdXBlcihjb21wb25lbnQpXG5cdFx0Y29tcG9uZW50LmVsLnNldFN0eWxlc1xuXHRcdFx0dG9wOiBudWxsXG5cdFx0XHRib3R0b206IG51bGxcblx0XHRcdGxlZnQ6IG51bGxcblx0XHRcdHJpZ2h0OiBudWxsXG5cdFx0cmV0dXJuXG5cblxubW9kdWxlLmV4cG9ydHMgPSBBYnNvbHV0ZUxheW91dFxuIiwiTGF5b3V0ID0gcmVxdWlyZSgnLi9MYXlvdXQnKVxuXG5jbGFzcyBBdXRvTGF5b3V0IGV4dGVuZHMgTGF5b3V0XG5cblx0Y29uc3RydWN0b3I6IChjb25maWcpIC0+XG5cdFx0c3VwZXIoY29uZmlnKVxuXHRcdEB0eXBlID0gJ2F1dG8nXG5cdFx0QHRhcmdldENscyA9ICcnXG5cdFx0QGl0ZW1DbHMgPSAnJ1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1dG9MYXlvdXQiLCJMYXlvdXQgPSByZXF1aXJlKCcuL0xheW91dCcpXG5cbmNsYXNzIEZpdExheW91dCBleHRlbmRzIExheW91dFxuXG5cdGNvbnN0cnVjdG9yOiAoY29uZmlnKSAtPlxuXHRcdHN1cGVyKGNvbmZpZylcblx0XHRAdHlwZSA9ICdmaXQnXG5cdFx0QHRhcmdldENscyA9ICdtaXdvLWxheW91dC1maXQnXG5cdFx0QGl0ZW1DbHMgPSAnbWl3by1sYXlvdXQtaXRlbSdcblxubW9kdWxlLmV4cG9ydHMgPSBGaXRMYXlvdXQiLCJMYXlvdXQgPSByZXF1aXJlKCcuL0xheW91dCcpXG5cbmNsYXNzIEZvcm1MYXlvdXQgZXh0ZW5kcyBMYXlvdXRcblxuXHRjb25zdHJ1Y3RvcjogKGNvbmZpZykgLT5cblx0XHRzdXBlcihjb25maWcpXG5cdFx0QHR5cGUgPSAnZm9ybSdcblx0XHRAdGFyZ2V0Q2xzID0gJ21pd28tbGF5b3V0LWZvcm0nXG5cdFx0QGl0ZW1DbHMgPSAnJ1xuXG5cbm1vZHVsZS5leHBvcnRzID0gRm9ybUxheW91dCIsIk1pd29PYmplY3QgPSByZXF1aXJlICgnLi4vY29yZS9PYmplY3QnKVxuXG5jbGFzcyBMYW95dXQgZXh0ZW5kcyBNaXdvT2JqZWN0XG5cblx0aXNMYXlvdXQ6IHRydWVcblx0dGFyZ2V0Q2xzOiBcIm1pd28tbGF5b3V0XCJcblx0aXRlbUNsczogXCJtaXdvLWxheW91dC1pdGVtXCJcblx0Y29udGFpbmVyOiBudWxsXG5cdGluaXRpYWxpemVkOiBmYWxzZVxuXHRydW5uaW5nOiBmYWxzZVxuXHRvd25lckxheW91dDogbnVsbFxuXHRlbmFibGVkOiB0cnVlXG5cblxuXHRzZXRDb250YWluZXI6IChjb250YWluZXIpIC0+XG5cdFx0QG11bm9uKEBjb250YWluZXIsIGNvbnRhaW5lciwgJ2FkZGVkJywgQGJvdW5kKFwib25BZGRlZFwiKSlcblx0XHRAbXVub24oQGNvbnRhaW5lciwgY29udGFpbmVyLCAncmVtb3ZlZCcsIEBib3VuZChcIm9uUmVtb3ZlZFwiKSlcblx0XHRAY29udGFpbmVyID0gY29udGFpbmVyXG5cdFx0cmV0dXJuXG5cblxuXHQjIFJldHVybnMgdGhlIHNldCBvZiBpdGVtcyB0byBsYXlvdXQgKGVtcHR5IGJ5IGRlZmF1bHQpLlxuXHQjIEByZXR1cm4ge0FycmF5fSBjb21wb25lbnRzXG5cdCMgQHByb3RlY3RlZFxuXHRnZXRMYXlvdXRDb21wb25lbnRzOiAtPlxuXHRcdHJldHVybiBAY29udGFpbmVyLmdldENvbXBvbmVudHMoKVxuXG5cblx0IyBSZXR1cm5zIHRoZSB0YXJnZXQgZWxlbWVudCB3aGVyZSBjaGlsZCB3aWxsIGJlIHJlbmRlcmVkXG5cdCMgQHByb3RlY3RlZFxuXHRnZXRSZW5kZXJUYXJnZXQ6IC0+XG5cdFx0cmV0dXJuIEBjb250YWluZXIuZ2V0Q29udGVudEVsKClcblxuXG5cdCMgQSBvbmUtdGltZSBpbml0aWFsaXphdGlvbiBtZXRob2QgY2FsbGVkIGp1c3QgYmVmb3JlIHJlbmRlcmluZy5cblx0IyBAcHJvdGVjdGVkXG5cdGluaXRMYXlvdXQ6IC0+XG5cdFx0QGluaXRpYWxpemVkID0gdHJ1ZVxuXHRcdHJldHVyblxuXG5cblx0IyBTZXRzIGxheW91dCBvd25lclxuXHQjIEBwcml2YXRlXG5cdHNldE93bmVyTGF5b3V0OiAobGF5b3V0KSAtPlxuXHRcdEBvd25lckxheW91dCA9IGxheW91dFxuXHRcdHJldHVyblxuXG5cblx0cmVuZGVyOiAtPlxuXHRcdEBnZXRSZW5kZXJUYXJnZXQoKS5hZGRDbGFzcyhAdGFyZ2V0Q2xzKSAgaWYgQHRhcmdldENsc1xuXHRcdEB1cGRhdGUoKVxuXHRcdHJldHVyblxuXG5cblx0dXBkYXRlOiAtPlxuXHRcdEByZW5kZXJDb21wb25lbnRzKEBnZXRMYXlvdXRDb21wb25lbnRzKCksIEBnZXRSZW5kZXJUYXJnZXQoKSlcblx0XHRyZXR1cm5cblxuXG5cdG9uQWRkZWQ6IChjb250YWluZXIsIGNvbXBvbmVudCwgcG9zaXRpb24pIC0+XG5cdFx0aWYgY29udGFpbmVyLnJlbmRlcmVkXG5cdFx0XHRAcmVuZGVyQ29tcG9uZW50KGNvbXBvbmVudCwgQGdldFJlbmRlclRhcmdldCgpLCBwb3NpdGlvbilcblx0XHRyZXR1cm5cblxuXG5cdG9uUmVtb3ZlZDogKGNvbnRhaW5lciwgY29tcG9uZW50KSAtPlxuXHRcdGlmIGNvbnRhaW5lci5yZW5kZXJlZFxuXHRcdFx0QHJlbW92ZUNvbXBvbmVudChjb21wb25lbnQpXG5cdFx0cmV0dXJuXG5cblxuXHQjIEl0ZXJhdGVzIG92ZXIgYWxsIHBhc3NlZCBpdGVtcywgZW5zdXJpbmcgdGhleSBhcmUgcmVuZGVyZWQuICBJZiB0aGUgaXRlbXMgYXJlIGFscmVhZHkgcmVuZGVyZWQsXG5cdCMgYWxzbyBkZXRlcm1pbmVzIGlmIHRoZSBpdGVtcyBhcmUgaW4gdGhlIHByb3BlciBwbGFjZSBpbiB0aGUgZG9tLlxuXHQjIEBwcm90ZWN0ZWRcblx0cmVuZGVyQ29tcG9uZW50czogKGNvbXBvbmVudHMsIHRhcmdldCkgLT5cblx0XHRpZiAhQGVuYWJsZWQgdGhlbiByZXR1cm5cblx0XHRjb21wb25lbnRzLmVhY2ggKGNvbXBvbmVudCwgaW5kZXgpID0+XG5cdFx0XHRpZiAhY29tcG9uZW50LnJlbmRlcmVkXG5cdFx0XHRcdEByZW5kZXJDb21wb25lbnQoY29tcG9uZW50LCB0YXJnZXQsIGluZGV4KVxuXHRcdFx0ZWxzZVxuXHRcdFx0XHRAdXBkYXRlQ29tcG9uZW50KGNvbXBvbmVudClcblx0XHRyZXR1cm5cblxuXG5cdCMgUmVuZGVycyB0aGUgZ2l2ZW4gQ29tcG9uZW50IGludG8gdGhlIHRhcmdldCBFbGVtZW50LlxuXHQjIEBwYXJhbSB7TWl3by5jb21wb25lbnQuQ29tcG9uZW50fSBpdGVtIFRoZSBDb21wb25lbnQgdG8gcmVuZGVyXG5cdCMgQHBhcmFtIHtFbGVtZW50fSB0YXJnZXQgVGhlIHRhcmdldCBFbGVtZW50XG5cdCMgQHBhcmFtIHtOdW1iZXJ9IHBvc2l0aW9uIFRoZSBwb3NpdGlvbiB3aXRoaW4gdGhlIHRhcmdldCB0byByZW5kZXIgdGhlIGl0ZW0gdG9cblx0IyBAcHJpdmF0ZVxuXHRyZW5kZXJDb21wb25lbnQ6IChjb21wb25lbnQsIHRhcmdldCwgcG9zaXRpb24pIC0+XG5cdFx0aWYgIUBlbmFibGVkIHRoZW4gcmV0dXJuXG5cdFx0aWYgIWNvbXBvbmVudC5yZW5kZXJlZCAmJiAhY29tcG9uZW50LnByZXZlbnRBdXRvUmVuZGVyXG5cdFx0XHRAY29uZmlndXJlQ29tcG9uZW50KGNvbXBvbmVudClcblx0XHRcdGNvbXBvbmVudC5yZW5kZXIodGFyZ2V0KVxuXHRcdFx0QGFmdGVyUmVuZGVyQ29tcG9uZW50KGNvbXBvbmVudClcblx0XHRyZXR1cm5cblxuXG5cdCMgVXBkYXRlIGNvbXBvbmVudCBhbmQgY2hpbGQgY29tcG9uZW50c1xuXHQjIEBwYXJhbSB7TWl3by5jb21wb25lbnQuQ29tcG9uZW50fSBpdGVtIFRoZSBDb21wb25lbnQgdG8gcmVuZGVyXG5cdCMgQHByaXZhdGVcblx0dXBkYXRlQ29tcG9uZW50OiAoY29tcG9uZW50KSAtPlxuXHRcdEBjb25maWd1cmVDb21wb25lbnQoY29tcG9uZW50KVxuXHRcdGNvbXBvbmVudC51cGRhdGUoKVxuXHRcdHJldHVyblxuXG5cblx0IyBDYWxsZWQgYmVmb3JlIGFuIGl0ZW0gaXMgcmVuZGVyZWQgdG8gYWxsb3cgdGhlIGxheW91dCB0byBjb25maWd1cmUgdGhlIGl0ZW0uXG5cdCMgQHBhcmFtIHtNaXdvLmNvbXBvbmVudC5Db21wb25lbnR9IGl0ZW0gVGhlIGl0ZW0gdG8gYmUgY29uZmlndXJlZFxuXHQjIEBwcm90ZWN0ZWRcblx0Y29uZmlndXJlQ29tcG9uZW50OiAoY29tcG9uZW50KSAtPlxuXHRcdGlmIGNvbXBvbmVudC5pc0NvbnRhaW5lciAmJiBjb21wb25lbnQuaGFzTGF5b3V0KClcblx0XHRcdGNvbXBvbmVudC5nZXRMYXlvdXQoKS5zZXRPd25lckxheW91dCh0aGlzKVxuXG5cdFx0Y29tcG9uZW50LmVsLmFkZENsYXNzKEBpdGVtQ2xzKSBpZiBAaXRlbUNsc1xuXHRcdGNvbXBvbmVudC5lbC5zZXRTdHlsZSgnd2lkdGgnLCBjb21wb25lbnQud2lkdGgpIGlmIGNvbXBvbmVudC53aWR0aCB8fCBjb21wb25lbnQud2lkdGggaXMgbnVsbFxuXHRcdGNvbXBvbmVudC5lbC5zZXRTdHlsZSgnaGVpZ2h0JywgY29tcG9uZW50LmhlaWdodCkgaWYgY29tcG9uZW50LmhlaWdodCB8fCBjb21wb25lbnQuaGVpZ2h0IGlzIG51bGxcblx0XHRyZXR1cm5cblxuXG5cdGFmdGVyUmVuZGVyQ29tcG9uZW50OiAoY29tcG9uZW50KSAtPlxuXHRcdHJldHVyblxuXG5cblx0IyBSZW1vdmUgY29tcG9uZW50IGZyb20gb3duZXIgY29tcG9uZW50cy5cblx0IyBAcGFyYW0ge01pd28uY29tcG9uZW50LkNvbXBvbmVudH0gaXRlbSBUaGUgQ29tcG9uZW50IHRvIHJlbW92ZVxuXHQjIEBwcml2YXRlXG5cdHJlbW92ZUNvbXBvbmVudDogKGNvbXBvbmVudCkgLT5cblx0XHRpZiBjb21wb25lbnQucmVuZGVyZWRcblx0XHRcdEB1bmNvbmZpZ3VyZUNvbXBvbmVudChjb21wb25lbnQpXG5cdFx0XHRjb21wb25lbnQuZWwuZGlzcG9zZSgpXG5cdFx0XHRAYWZ0ZXJSZW1vdmVDb21wb25lbnQoY29tcG9uZW50KVxuXHRcdHJldHVyblxuXG5cblx0IyBSZXZlcnNlIG9mIGNvbmZpZ3VyZSBjb21wb25lbnRcblx0IyBAcGFyYW0ge01pd28uY29tcG9uZW50LkNvbXBvbmVudH0gaXRlbSBUaGUgaXRlbSB0byBiZSBjb25maWd1cmVkXG5cdCMgQHByb3RlY3RlZFxuXHR1bmNvbmZpZ3VyZUNvbXBvbmVudDogKGNvbXBvbmVudCkgLT5cblx0XHRpZiBjb21wb25lbnQuaXNDb250YWluZXIgJiYgY29tcG9uZW50Lmhhc0xheW91dCgpXG5cdFx0XHRjb21wb25lbnQuZ2V0TGF5b3V0KCkuc2V0T3duZXJMYXlvdXQobnVsbClcblxuXHRcdGNvbXBvbmVudC5lbC5yZW1vdmVDbGFzcyhAaXRlbUNscykgaWYgQGl0ZW1DbHNcblx0XHRjb21wb25lbnQuZWwuc2V0U3R5bGUoJ3dpZHRoJywgbnVsbCkgaWYgY29tcG9uZW50LndpZHRoXG5cdFx0Y29tcG9uZW50LmVsLnNldFN0eWxlKCdoZWlnaHQnLCBudWxsKSBpZiBjb21wb25lbnQuaGVpZ2h0XG5cdFx0cmV0dXJuXG5cblxuXHQjIFJlbW92ZXMgbGF5b3V0J3MgaXRlbUNscyBhbmQgb3duaW5nIENvbnRhaW5lcidzIGl0ZW1DbHMuXG5cdCMgQ2xlYXJzIHRoZSBtYW5hZ2VkIGRpbWVuc2lvbnMgZmxhZ3Ncblx0IyBAcHJvdGVjdGVkXG5cdGFmdGVyUmVtb3ZlQ29tcG9uZW50OiAoY29tcG9uZW50KSAtPlxuXHRcdHJldHVyblxuXG5cblx0IyBEZXN0cm95cyB0aGlzIGxheW91dC4gVGhpcyBtZXRob2QgcmVtb3ZlcyBhIGB0YXJnZXRDbHNgIGZyb20gdGhlIGB0YXJnZXRgXG5cdCMgZWxlbWVudCBhbmQgY2FsbHMgYGRvRGVzdHJveWAuXG5cdCMgQSBkZXJpdmVkIGNsYXNzIGNhbiBvdmVycmlkZSBlaXRoZXIgdGhpcyBtZXRob2Qgb3IgYGRvRGVzdHJveWAgYnV0IGluIGFsbFxuXHQjIGNhc2VzIG11c3QgY2FsbCB0aGUgYmFzZSBjbGFzcyB2ZXJzaW9ucyBvZiB0aGVzZSBtZXRob2RzIHRvIGFsbG93IHRoZSBiYXNlIGNsYXNzIHRvXG5cdCMgcGVyZm9ybSBpdHMgY2xlYW51cC5cblx0IyBAcHJvdGVjdGVkXG5cdGRvRGVzdHJveTogLT5cblx0XHRAZ2V0UmVuZGVyVGFyZ2V0KCkucmVtb3ZlQ2xhc3MoQHRhcmdldENscykgaWYgQHRhcmdldENsc1xuXHRcdEBzZXRDb250YWluZXIobnVsbClcblx0XHRzdXBlcigpXG5cdFx0cmV0dXJuXG5cblxubW9kdWxlLmV4cG9ydHMgPSBMYW95dXQiLCJtb2R1bGUuZXhwb3J0cyA9XG5cblx0QWJzb2x1dGU6IHJlcXVpcmUoJy4vQWJzb2x1dGUnKVxuXHRGb3JtOiByZXF1aXJlKCcuL0Zvcm0nKVxuXHRGaXQ6IHJlcXVpcmUoJy4vRml0Jylcblx0QXV0bzogcmVxdWlyZSgnLi9BdXRvJylcblx0TGF5b3V0OiByZXF1aXJlKCcuL0xheW91dCcpXG5cblx0Y3JlYXRlTGF5b3V0OiAodHlwZSkgLT5cblx0XHRyZXR1cm4gbmV3IHRoaXNbdHlwZS5jYXBpdGFsaXplKCldKCkiLCJjbGFzcyBUcmFuc2xhdG9yXG5cblx0dHJhbnNsYXRlczogbnVsbFxuXHRsYW5nOiBudWxsXG5cdGRlZmF1bHRMYW5nOiBudWxsXG5cblxuXHRjb25zdHJ1Y3RvcjogKCkgLT5cblx0XHRAdHJhbnNsYXRlcyA9IHt9XG5cdFx0cmV0dXJuXG5cblxuXHRzZXREZWZhdWx0OiAoQGRlZmF1bHRMYW5nKSAtPlxuXHRcdHJldHVyblxuXG5cblx0c2V0VHJhbnNsYXRlczogKGxhbmcsIG5hbWUsIHRyYW5zbGF0ZXMpIC0+XG5cdFx0aWYgIUBkZWZhdWx0TGFuZ1xuXHRcdFx0QGRlZmF1bHRMYW5nID0gbGFuZ1xuXHRcdFx0QGxhbmcgPSBsYW5nXG5cblx0XHRpZiAhQHRyYW5zbGF0ZXNbbGFuZ11cblx0XHRcdEB0cmFuc2xhdGVzW2xhbmddID0ge31cblxuXHRcdGlmICFAdHJhbnNsYXRlc1tsYW5nXVtuYW1lXVxuXHRcdFx0QHRyYW5zbGF0ZXNbbGFuZ11bbmFtZV0gPSB0cmFuc2xhdGVzXG5cdFx0ZWxzZVxuXHRcdFx0T2JqZWN0Lm1lcmdlKEB0cmFuc2xhdGVzW2xhbmddW25hbWVdLCB0cmFuc2xhdGVzKVxuXHRcdHJldHVyblxuXG5cblx0dXNlOiAoQGxhbmcpIC0+XG5cdFx0cmV0dXJuXG5cblxuXHRnZXQ6IChrZXkpIC0+XG5cdFx0dHJhbnNsYXRlZCA9IEBnZXRCeUxhbmcoa2V5LCBAbGFuZylcblx0XHRpZiB0cmFuc2xhdGVkIGlzIG51bGxcblx0XHRcdHRyYW5zbGF0ZWQgPSBAZ2V0QnlMYW5nKGtleSwgQGRlZmF1bHRMYW5nKVxuXHRcdGlmIHRyYW5zbGF0ZWQgaXMgbnVsbFxuXHRcdFx0dHJhbnNsYXRlZCA9ICcnXG5cdFx0cmV0dXJuIHRyYW5zbGF0ZWRcblxuXG5cdGdldEJ5TGFuZzogKGtleSwgbGFuZykgLT5cblx0XHRncm91cCA9IEB0cmFuc2xhdGVzW2xhbmddXG5cdFx0aWYgIWdyb3VwXG5cdFx0XHRyZXR1cm4gbnVsbFxuXHRcdGZvciBwYXJ0IGluIGtleS5zcGxpdCgnLicpXG5cdFx0XHRncm91cCA9IGdyb3VwW3BhcnRdXG5cdFx0XHRpZiBncm91cCBpcyB1bmRlZmluZWQgdGhlbiByZXR1cm4gbnVsbFxuXHRcdFx0aWYgIWdyb3VwIHRoZW4gYnJlYWtcblx0XHRyZXR1cm4gZ3JvdXBcblxuXG5tb2R1bGUuZXhwb3J0cyA9IFRyYW5zbGF0b3IiLCJtb2R1bGUuZXhwb3J0cyA9XG5cblx0VHJhbnNsYXRvcjogcmVxdWlyZSAnLi9UcmFuc2xhdG9yJyIsImNsYXNzIENvbGxlY3Rpb25cblxuXHRjb25zdHJ1Y3RvcjogKG9iamVjdCA9IG51bGwpIC0+XG5cdFx0QGl0ZW1zID0ge31cblx0XHRAbGVuZ3RoID0gMFxuXHRcdGlmIG9iamVjdFxuXHRcdFx0aWYgb2JqZWN0IGluc3RhbmNlb2YgQ29sbGVjdGlvblxuXHRcdFx0XHRmb3Iga2V5IG9mIG9iamVjdC5pdGVtc1xuXHRcdFx0XHRcdEBpdGVtc1trZXldID0gb2JqZWN0Lml0ZW1zW2tleV1cblx0XHRcdGVsc2Vcblx0XHRcdFx0Zm9yIGtleSBvZiBvYmplY3Rcblx0XHRcdFx0XHRAaXRlbXNba2V5XSA9IG9iamVjdFtrZXldXG5cblxuXHRlYWNoOiAoY2IpIC0+XG5cdFx0T2JqZWN0LmVhY2goQGl0ZW1zLCBjYilcblx0XHRyZXR1cm5cblxuXG5cdGZpbHRlcjogKGNiKSAtPlxuXHRcdHJldHVybiBPYmplY3QuZmlsdGVyKEBpdGVtcywgY2IpXG5cblxuXHRmaW5kOiAoY2IpIC0+XG5cdFx0cmV0dXJuIE9iamVjdC5zb21lKEBpdGVtcywgY2IpXG5cblxuXHRzZXQ6IChuYW1lLCB2YWx1ZSkgLT5cblx0XHRpZiAhQGhhcyhuYW1lKSB0aGVuIEBsZW5ndGgrK1xuXHRcdEBpdGVtc1tuYW1lXSA9IHZhbHVlXG5cdFx0cmV0dXJuXG5cblxuXHRnZXQ6IChuYW1lLCBkZWYgPSBudWxsKSAtPlxuXHRcdHJldHVybiBpZiBAaGFzKG5hbWUpIHRoZW4gQGl0ZW1zW25hbWVdIGVsc2UgZGVmXG5cblxuXHRnZXRCeTogKG5hbWUsIHZhbHVlKSAtPlxuXHRcdGZvciBpdGVtIGluIEBpdGVtc1xuXHRcdFx0aWYgaXRlbVtuYW1lXSBpcyB2YWx1ZVxuXHRcdFx0XHRyZXR1cm4gaXRlbVxuXHRcdHJldHVybiBudWxsXG5cblxuXHRoYXM6IChuYW1lKSAtPlxuXHRcdHJldHVybiBAaXRlbXNbbmFtZV0gaXNudCB1bmRlZmluZWRcblxuXG5cdHJlbW92ZTogKG5hbWUpIC0+XG5cdFx0aWYgQGl0ZW1zW25hbWVdXG5cdFx0XHRkZWxldGUgQGl0ZW1zW25hbWVdXG5cdFx0XHRAbGVuZ3RoLS1cblx0XHRyZXR1cm5cblxuXG5cdGVtcHR5OiAtPlxuXHRcdEBpdGVtcyA9IHt9XG5cdFx0QGxlbmd0aCA9IDBcblx0XHRyZXR1cm5cblxuXG5cdGdldEZpcnN0OiAtPlxuXHRcdGZvciBrZXksaXRlbSBvZiBAaXRlbXNcblx0XHRcdHJldHVybiBpdGVtXG5cdFx0cmV0dXJuIG51bGxcblxuXG5cdGdldExhc3Q6IC0+XG5cdFx0bGFzdCA9IG51bGxcblx0XHRmb3Iga2V5LGl0ZW0gb2YgQGl0ZW1zXG5cdFx0XHRsYXN0ID0gaXRlbVxuXHRcdFx0Y29udGludWVcblx0XHRyZXR1cm4gbGFzdFxuXG5cblx0a2V5T2Y6ICh2YWx1ZSkgLT5cblx0XHRyZXR1cm4gT2JqZWN0LmtleU9mKEBpdGVtcywgdmFsdWUpXG5cblxuXHRpbmRleE9mOiAoZmluZCkgLT5cblx0XHRpbmRleCA9IDBcblx0XHRmb3Iga2V5LGl0ZW0gb2YgQGl0ZW1zXG5cdFx0XHRpZiBpdGVtIGlzIGZpbmQgdGhlbiByZXR1cm4gaW5kZXhcblx0XHRcdGluZGV4Kytcblx0XHRyZXR1cm4gLTFcblxuXG5cdGdldEF0OiAoYXQpIC0+XG5cdFx0aW5kZXggPSAwXG5cdFx0Zm9yIGtleSxpdGVtIG9mIEBpdGVtc1xuXHRcdFx0aWYgaW5kZXggaXMgYXQgdGhlbiByZXR1cm4gaXRlbVxuXHRcdFx0aW5kZXgrK1xuXHRcdHJldHVybiBudWxsXG5cblxuXHRnZXRLZXlzOiAtPlxuXHRcdHJldHVybiBPYmplY3Qua2V5cyhAaXRlbXMpXG5cblxuXHRnZXRWYWx1ZXM6IC0+XG5cdFx0cmV0dXJuIE9iamVjdC52YWx1ZXMoQGl0ZW1zKVxuXG5cblx0dG9BcnJheTogLT5cblx0XHRhcnJheSA9IFtdXG5cdFx0Zm9yIGtleSxpdGVtIG9mIEBpdGVtc1xuXHRcdFx0YXJyYXkucHVzaChpdGVtKVxuXHRcdHJldHVybiBhcnJheVxuXG5cblx0ZGVzdHJveTogLT5cblx0XHRmb3Iga2V5LGl0ZW0gb2YgQGl0ZW1zXG5cdFx0XHRpZiBpdGVtLmRlc3Ryb3kgdGhlbiBpdGVtLmRlc3Ryb3koKVxuXHRcdFx0ZGVsZXRlIEBpdGVtc1trZXldXG5cdFx0cmV0dXJuXG5cblxubW9kdWxlLmV4cG9ydHMgPSBDb2xsZWN0aW9uIiwiY2xhc3MgRGVmYXVsdEZsYXNoUmVuZGVyXG5cblxuXHRzaG93OiAobWVzc2FnZSwgdHlwZSkgLT5cblx0XHRpZiAhY29uc29sZVxuXHRcdFx0cmV0dXJuXG5cdFx0aWYgdHlwZSBpcyAnZXJyb3InXG5cdFx0XHRjb25zb2xlLmVycm9yKG1lc3NhZ2UpXG5cdFx0ZWxzZVxuXHRcdFx0Y29uc29sZS5sb2coJ0ZMQVNIOicsIG1lc3NhZ2UsIHR5cGUpXG5cdFx0cmV0dXJuXG5cblxuXG5jbGFzcyBGbGFzaE5vdGlmaWNhdG9yXG5cblx0cmVuZGVyZXI6IG51bGxcblxuXG5cdGNvbnN0cnVjdG9yOiAtPlxuXHRcdEByZW5kZXJlciA9IG5ldyBEZWZhdWx0Rmxhc2hSZW5kZXIoKVxuXHRcdHJldHVyblxuXG5cblx0c3VjY2VzczogKG1lc3NhZ2UpIC0+XG5cdFx0QG1lc3NhZ2UobWVzc2FnZSwgJ3N1Y2Nlc3MnKVxuXHRcdHJldHVyblxuXG5cblx0ZXJyb3I6IChtZXNzYWdlKSAtPlxuXHRcdEBtZXNzYWdlKG1lc3NhZ2UsICdlcnJvcicpXG5cdFx0cmV0dXJuXG5cblxuXHRpbmZvOiAobWVzc2FnZSkgLT5cblx0XHRAbWVzc2FnZShtZXNzYWdlLCAnaW5mbycpXG5cdFx0cmV0dXJuXG5cblxuXHR3YXJuaW5nOiAobWVzc2FnZSkgLT5cblx0XHRAbWVzc2FnZShtZXNzYWdlLCAnd2FybmluZycpXG5cdFx0cmV0dXJuXG5cblxuXHRtZXNzYWdlOiAobWVzc2FnZSwgdHlwZSkgLT5cblx0XHRAcmVuZGVyZXIuc2hvdyhtZXNzYWdlLCB0eXBlKSAgaWYgQHJlbmRlcmVyXG5cdFx0cmV0dXJuXG5cblxubW9kdWxlLmV4cG9ydHMgPSBGbGFzaE5vdGlmaWNhdG9yIiwiY2xhc3MgS2V5TGlzdGVuZXJcblxuXHR0YXJnZXQ6IG51bGxcblx0ZXZlbnQ6ICdrZXl1cCdcblx0aGFuZGxlcnM6IG51bGxcblx0aGFuZGxlRXZlbnQ6IG51bGxcblx0cGF1c2VkOiB0cnVlXG5cblxuXHRjb25zdHJ1Y3RvcjogKHRhcmdldCwgZXZlbnQpIC0+XG5cdFx0QHRhcmdldCA9IHRhcmdldFxuXHRcdEBldmVudCA9IGV2ZW50IGlmIGV2ZW50XG5cdFx0QGhhbmRsZXJzID0ge31cblx0XHRAaGFuZGxlRXZlbnQgPSAoZSk9PlxuXHRcdFx0aWYgQGhhbmRsZXJzW2Uua2V5XVxuXHRcdFx0XHRzdG9wRXZlbnQgPSBAaGFuZGxlcnNbZS5rZXldKGUpXG5cdFx0XHRcdGlmIHN0b3BFdmVudCB0aGVuIGUuc3RvcCgpXG5cdFx0XHRyZXR1cm5cblx0XHRAcmVzdW1lKClcblx0XHRyZXR1cm5cblxuXG5cdG9uOiAobmFtZSwgaGFuZGxlcikgLT5cblx0XHRAaGFuZGxlcnNbbmFtZV0gPSBoYW5kbGVyXG5cdFx0cmV0dXJuXG5cblxuXHRyZXN1bWU6ICgpIC0+XG5cdFx0aWYgIUBwYXVzZWQgdGhlbiByZXR1cm5cblx0XHRAcGF1c2VkID0gZmFsc2Vcblx0XHRAdGFyZ2V0Lm9uKEBldmVudCwgQGhhbmRsZUV2ZW50KVxuXHRcdHJldHVyblxuXG5cblx0cGF1c2U6ICgpIC0+XG5cdFx0aWYgQHBhdXNlZCB0aGVuIHJldHVyblxuXHRcdEBwYXVzZWQgPSB0cnVlXG5cdFx0QHRhcmdldC51bihAZXZlbnQsIEBoYW5kbGVFdmVudClcblx0XHRyZXR1cm5cblxuXG5cdGRlc3Ryb3k6ICgpIC0+XG5cdFx0QHBhdXNlKClcblx0XHRyZXR1cm5cblxuXG5tb2R1bGUuZXhwb3J0cyA9IEtleUxpc3RlbmVyIiwiTWl3b09iamVjdCA9IHJlcXVpcmUgJy4uL2NvcmUvT2JqZWN0J1xuXG5cbmNsYXNzIE92ZXJsYXkgZXh0ZW5kcyBNaXdvT2JqZWN0XG5cblx0IyBAZXZlbnQgY2xpY2tcblx0IyBAZXZlbnQgY2xvc2Vcblx0IyBAZXZlbnQgaGlkZVxuXHQjIEBldmVudCBvcGVuXG5cdCMgQGV2ZW50IHNob3dcblxuXHRjb2xvcjogXCIjMDAwXCJcblx0b3BhY2l0eTogMC41XG5cdHpJbmRleDogNTAwMFxuXHR0YXJnZXQ6IG51bGxcblx0b3ZlcmxheTogbnVsbFxuXG5cblx0Y29uc3RydWN0b3I6IChAdGFyZ2V0LCBjb25maWcpIC0+XG5cdFx0c3VwZXIoY29uZmlnKVxuXG5cdFx0QG92ZXJsYXkgPSBuZXcgRWxlbWVudCBcImRpdlwiLFxuXHRcdFx0cGFyZW50OiBAdGFyZ2V0XG5cdFx0XHRjbHM6IFwibWl3by1vdmVybGF5XCJcblx0XHRcdHN0eWxlczpcblx0XHRcdFx0cG9zaXRpb246IFwiYWJzb2x1dGVcIlxuXHRcdFx0XHRiYWNrZ3JvdW5kOiBAY29sb3Jcblx0XHRcdFx0XCJ6LWluZGV4XCI6IEB6SW5kZXhcblxuXHRcdEBvdmVybGF5Lm9uKCdjbGljaycsICgpPT5AZW1pdCgnY2xpY2snKSlcblx0XHRyZXR1cm5cblxuXG5cdHNldFpJbmRleDogKHpJbmRleCkgLT5cblx0XHRAb3ZlcmxheS5zZXRTdHlsZShcInotaW5kZXhcIiwgekluZGV4KVxuXHRcdHJldHVyblxuXG5cblx0b3BlbjogLT5cblx0XHRAb3BlbmVkID0gdHJ1ZVxuXHRcdEBlbWl0KFwib3BlblwiKVxuXHRcdEB0YXJnZXQuYWRkQ2xhc3MoXCJtaXdvLW92ZXJsYXllZFwiKVxuXHRcdEBvdmVybGF5LnNldFN0eWxlKFwiZGlzcGxheVwiLCBcImJsb2NrXCIpXG5cdFx0KCgpPT5Ab3ZlcmxheS5zZXRTdHlsZShcIm9wYWNpdHlcIiwgQG9wYWNpdHkpKS5kZWxheSgxKVxuXHRcdEBlbWl0KFwic2hvd1wiKVxuXHRcdHJldHVyblxuXG5cblx0Y2xvc2U6IC0+XG5cdFx0QG9wZW5lZCA9IGZhbHNlXG5cdFx0QGVtaXQoXCJjbG9zZVwiKVxuXHRcdEB0YXJnZXQucmVtb3ZlQ2xhc3MoXCJtaXdvLW92ZXJsYXllZFwiKVxuXHRcdEBvdmVybGF5LnNldFN0eWxlKFwib3BhY2l0eVwiLCAwLjApXG5cdFx0KCgpPT5Ab3ZlcmxheS5zZXRTdHlsZShcImRpc3BsYXlcIiwgXCJub25lXCIpIGlmICFAb3BlbmVkICkuZGVsYXkoMzAwKVxuXHRcdEBlbWl0KFwiaGlkZVwiKVxuXHRcdHJldHVyblxuXG5cblx0ZG9EZXN0cm95OiAtPlxuXHRcdEBvdmVybGF5LmRlc3Ryb3koKVxuXHRcdHN1cGVyXG5cblxubW9kdWxlLmV4cG9ydHMgPSBPdmVybGF5IiwibW9kdWxlLmV4cG9ydHMgPVxuXG5cdE92ZXJsYXk6IHJlcXVpcmUgJy4vT3ZlcmxheSdcblx0Q29sbGVjdGlvbjogcmVxdWlyZSAnLi9Db2xsZWN0aW9uJ1xuXHRLZXlMaXN0ZW5lcjogcmVxdWlyZSAnLi9LZXlMaXN0ZW5lcidcblx0Rmxhc2hOb3RpZmljYXRvcjogcmVxdWlyZSAnLi9GbGFzaE5vdGlmaWNhdG9yJyJdfQ==
