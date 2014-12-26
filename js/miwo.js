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
var ComponentManager, ComponentSelector, CookieManager, InjectorExtension, MiwoExtension, RequestManager, Translator, ZIndexManager,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

InjectorExtension = require('./di/InjectorExtension');

RequestManager = require('./http/RequestManager');

CookieManager = require('./http/CookieManager');

ComponentManager = require('./component/ComponentManager');

ComponentSelector = require('./component/ComponentSelector');

ZIndexManager = require('./component/ZIndexManager');

Translator = require('./locale/Translator');

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
          redirect: require('./http/plugins').RedirectPlugin,
          failure: require('./http/plugins').FailurePlugin,
          error: require('./http/plugins').ErrorPlugin
        }
      },
      cookie: {
        document: null
      },
      di: {
        services: {}
      }
    });
  };

  MiwoExtension.prototype.build = function(injector) {
    var name, namespace, service, _ref;
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
    _ref = this.config.di.services;
    for (name in _ref) {
      service = _ref[name];
      injector.setGlobal(name, service);
    }
    injector.define('translator', Translator, (function(_this) {
      return function(service) {};
    })(this));
    injector.define('http', RequestManager, (function(_this) {
      return function(service) {
        var plugin, _ref1;
        service.params = _this.config.http.params;
        _ref1 = _this.config.http.plugins;
        for (name in _ref1) {
          plugin = _ref1[name];
          service.register(name, new plugin());
        }
      };
    })(this));
    injector.define('cookie', CookieManager, (function(_this) {
      return function(service) {
        if (_this.config.cookie.document) {
          service.document = _this.config.cookie.document;
        }
      };
    })(this));
    injector.define('componentMgr', ComponentManager);
    injector.define('componentSelector', ComponentSelector);
    injector.define('zIndexMgr', ZIndexManager);
  };

  return MiwoExtension;

})(InjectorExtension);

module.exports = MiwoExtension;


},{"./component/ComponentManager":6,"./component/ComponentSelector":7,"./component/ZIndexManager":9,"./di/InjectorExtension":19,"./http/CookieManager":23,"./http/RequestManager":26,"./http/plugins":28,"./locale/Translator":36}],3:[function(require,module,exports){
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


},{"../di/InjectorFactory":20}],4:[function(require,module,exports){
var Configurator, Miwo;

Configurator = require('./Configurator');

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

  Miwo.prototype.componentSelector = Miwo.service('componentSelector');

  Miwo.prototype.windowMgr = Miwo.service('windowMgr');

  Miwo.prototype.application = Miwo.service('application');

  Miwo.prototype.translator = Miwo.service('translator');

  Miwo.prototype.injector = null;

  Miwo.prototype.extensions = null;

  function Miwo() {
    this.ready((function(_this) {
      return function() {
        return _this.body = document.getElementsByTagName('body')[0];
      };
    })(this));
    this.extensions = {};
  }

  Miwo.prototype.ready = function(callback) {
    window.on('domready', callback);
  };

  Miwo.prototype.tr = function(key) {
    return this.translator.get(key);
  };

  Miwo.prototype.require = function(file) {
    var data, e;
    data = miwo.http.read(file + "?t=" + (new Date().getTime()));
    try {
      eval(data);
    } catch (_error) {
      e = _error;
      throw new Error("Cant require file " + file + ", data are not evaluable. Reason " + (e.getMessage()));
    }
  };

  Miwo.prototype.get = function(id) {
    return this.componentMgr.get(id);
  };

  Miwo.prototype.select = function(selector) {
    return this.componentSelector.select(selector);
  };

  Miwo.prototype.selectAll = function(selector) {
    return this.componentSelector.selectAll(selector);
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
    this.baseUrl = injector.params.baseUrl;
    _ref = injector.globals;
    for (name in _ref) {
      service = _ref[name];
      Miwo.service(name, service);
    }
  };

  Miwo.prototype.init = function(onInit) {
    var configurator, injector;
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


},{"./Configurator":3}],5:[function(require,module,exports){
var Component, MiwoObject,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

MiwoObject = require('../core/Object');

Component = (function(_super) {
  __extends(Component, _super);

  Component.prototype.isComponent = true;

  Component.prototype.xtype = 'component';

  Component.prototype.id = null;

  Component.prototype.name = null;

  Component.prototype.width = null;

  Component.prototype.height = null;

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

  Component.prototype._isGeneratedId = false;

  Component.prototype.zIndexMgr = null;

  Component.prototype.componentMgr = null;

  function Component(config) {
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
    return;
  }

  Component.prototype.beforeInit = function() {
    this.calledBeforeInit = true;
  };

  Component.prototype.doInit = function() {
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
    this.focusEl = this.el;
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
    this._isGeneratedId = false;
    this.id = id;
    this.el.set("id", id);
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

  Component.prototype.getFocusEl = function() {
    return this.focusEl;
  };

  Component.prototype.setEl = function(el) {
    this.el = el;
    if (this.contentEl) {
      this.contentEl.inject(el);
    }
  };

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

  Component.prototype.setDisabled = function(disabled) {
    this.disabled = disabled;
    this.emit("disabled", this, disabled);
  };

  Component.prototype.setFocus = function() {
    this.focus = true;
    this.getFocusEl().setFocus();
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

  Component.prototype.isXtype = function(xtype) {
    return this.xtype === xtype;
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
    } else {
      this.detachedContainer(this.container);
      this.container = null;
    }
    return this;
  };

  Component.prototype.getParent = function() {
    return this.container;
  };

  Component.prototype.up = function(selector) {
    return miwo.componentSelector.selectParent(this, selector);
  };

  Component.prototype.is = function(selector) {
    return miwo.componentSelector.is(this, selector);
  };

  Component.prototype.nextSibling = function() {
    return this.getParent().nextSiblingOf(this);
  };

  Component.prototype.previousSibling = function() {
    return this.getParent().previousSiblingOf(this);
  };

  Component.prototype.attachedContainer = function(parent) {};

  Component.prototype.detachedContainer = function(parent) {};

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

  Component.prototype.update = function() {};

  Component.prototype.resetRendered = function(dispose) {
    this.rendered = false;
    this.parentEl = null;
    if (dispose) {
      this.el.empty();
      this.el.dispose();
    }
  };

  Component.prototype.render = function(el, position) {
    var contentEl;
    if (!el && this.renderTo) {
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
    contentEl = this.getElement('[miwo-reference="contentEl"]');
    if (contentEl) {
      this.contentEl = contentEl;
    }
    this.rendering = true;
    this.emit("render", this, this.el);
    this.doRender();
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
    this.emit("rendered", this, this.getContentEl());
  };

  Component.prototype.replace = function(target) {
    target = target || $(this.id);
    if (target) {
      this.render(target, 'replace');
    }
  };

  Component.prototype.redraw = function() {
    this.resetRendered();
    this.render();
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
    if (this.visible) {
      return;
    }
    this.emit("show", this);
    this.render();
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

  Component.prototype.setActive = function(active, newActive) {
    if (active) {
      this.emit("activated", this);
    } else {
      this.emit("deactivated", this);
    }
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
    var _ref;
    if (((_ref = this.template) != null ? _ref.destroy : void 0) != null) {
      this.template.destroy();
    }
    this.el.eliminate("component");
    this.el.destroy();
  };

  Component.prototype.afterDestroy = function() {
    this.emit("destroyed", this);
  };

  return Component;

})(MiwoObject);

module.exports = Component;


},{"../core/Object":14}],6:[function(require,module,exports){
var ComponentManager, MiwoObject,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

MiwoObject = require('../core/Object');

ComponentManager = (function(_super) {
  __extends(ComponentManager, _super);

  ComponentManager.prototype.list = null;

  ComponentManager.prototype.names = null;

  ComponentManager.prototype.id = 1;

  function ComponentManager() {
    ComponentManager.__super__.constructor.call(this);
    this.list = {};
    this.names = {};
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

  ComponentManager.prototype.register = function(comp) {
    if (comp.componentMgr) {
      throw new Error("Component " + comp + " with id " + comp.id + " already exists.");
    }
    comp.componentMgr = this;
    this.list[comp.id] = comp;
    this.emit("register", comp);
  };

  ComponentManager.prototype.unregister = function(comp) {
    if (this.list[comp.id]) {
      delete this.list[comp.id];
      delete comp.componentMgr;
      this.emit("unregister", comp);
    }
  };

  ComponentManager.prototype.beforeRender = function(component) {
    this.emit("beforerender", component);
  };

  ComponentManager.prototype.afterRender = function(component) {
    this.emit("afterrender", component);
  };

  ComponentManager.prototype.get = function(id) {
    return (this.list[id] ? this.list[id] : null);
  };

  return ComponentManager;

})(MiwoObject);

module.exports = ComponentManager;


},{"../core/Object":14}],7:[function(require,module,exports){
var ComponentSelector;

ComponentSelector = (function() {
  function ComponentSelector() {}

  ComponentSelector.prototype.selectParent = function(component, selector) {
    component = this.getParent();
    while (component) {
      if (component.is(selector)) {
        break;
      }
      component = component.getParent();
    }
    return component;
  };

  ComponentSelector.prototype.is = function(component, selector) {
    if (selector.test(/^\#([\w\-]+)/)) {
      return selector.replace(/\#/, "") === component.id;
    } else if (selector) {
      return component.isXtype(selector);
    } else {
      return false;
    }
  };

  ComponentSelector.prototype.select = function(selector, component) {
    if (component == null) {
      component = null;
    }
    throw new Error("Not implemented");
  };

  ComponentSelector.prototype.selectAll = function(selector, component) {
    if (component == null) {
      component = null;
    }
    throw new Error("Not implemented");
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

  Container.prototype.getComponents = function() {
    return this.components;
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

  Container.prototype.select = function(selector) {
    if (selector == null) {
      selector = "*";
    }
    return miwo.componentSelector.select(selector, this);
  };

  Container.prototype.selectAll = function(selector) {
    if (selector == null) {
      selector = "*";
    }
    return miwo.componentSelector.selectAll(selector, this);
  };

  Container.prototype.child = function(selector) {
    if (selector == null) {
      selector = "*";
    }
    return this.select("> " + selector);
  };

  Container.prototype.down = function(selector) {
    return this.select(selector);
  };

  Container.prototype.get = function(name, need) {
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
    Container.__super__.doRender.call(this);
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
      el.removeAttribute('miwo-component');
      component.setEl(el);
      component.parentEl = this.getContentEl();
      component.render();
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

  Container.prototype.removeAllComponents = function() {
    this.components.each((function(_this) {
      return function(component, name) {
        _this.removeComponent(name);
        component.destroy();
      };
    })(this));
  };

  Container.prototype.doDestroy = function() {
    this.removeAllComponents();
    if (this.hasLayout()) {
      this.setLayout(null);
    }
    return Container.__super__.doDestroy.call(this);
  };

  return Container;

})(Component);

module.exports = Container;


},{"../layout":35,"../utils/Collection":38,"./Component":5}],9:[function(require,module,exports){
var MiwoObject, Overlay, ZIndexManager,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

MiwoObject = require('../core/Object');

Overlay = require('../utils/Overlay');

ZIndexManager = (function(_super) {
  __extends(ZIndexManager, _super);

  ZIndexManager.prototype.zIndexBase = 10000;

  ZIndexManager.prototype.zIndex = 0;

  ZIndexManager.prototype.list = {};

  ZIndexManager.prototype.stack = [];

  ZIndexManager.prototype.front = null;

  ZIndexManager.prototype.overlay = null;

  function ZIndexManager() {
    ZIndexManager.__super__.constructor.call(this);
    this.zIndex = this.zIndexBase;
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


},{"../core/Object":14,"../utils/Overlay":40}],10:[function(require,module,exports){
module.exports = {
  Component: require('./Component'),
  Container: require('./Container')
};


},{"./Component":5,"./Container":8}],11:[function(require,module,exports){
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


},{}],12:[function(require,module,exports){
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


},{}],13:[function(require,module,exports){
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
    this.removeManagedListeners(object, name, listener);
  };

  Events.prototype.munon = function(old, obj, name, listener) {
    if (old === obj) {
      return;
    }
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


},{"events":1}],14:[function(require,module,exports){
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
      this[k] = v;
    }
  };

  MiwoObject.prototype.set = function(name, value) {
    this[name] = value;
    return this;
  };

  MiwoObject.prototype.destroy = function() {
    if (this.isDestroyed) {
      return;
    }
    this.destroying = true;
    if (this.beforeDestroy) {
      this.beforeDestroy();
    }
    this._callDestroy();
    if (this.doDestroy) {
      this.doDestroy();
    }
    this.destroying = false;
    this.isDestroyed = true;
    if (this.afterDestroy) {
      this.afterDestroy();
    }
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

  return MiwoObject;

})(Events);

MiwoObject.addMethod = function(name, method) {
  this.prototype[name] = method;
};

module.exports = MiwoObject;


},{"./Events":13}],15:[function(require,module,exports){
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


},{}],16:[function(require,module,exports){
module.exports = {
  Events: require('./Events'),
  Object: require('./Object')
};


},{"./Events":13,"./Object":14}],17:[function(require,module,exports){
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
          result.push(instance[op]);
        } else if (!args) {
          result.push(instance[op]());
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


},{}],18:[function(require,module,exports){
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


},{"./DiHelper":17,"./Service":21}],19:[function(require,module,exports){
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


},{"./DiHelper":17}],20:[function(require,module,exports){
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


},{"./DiHelper":17,"./Injector":18}],21:[function(require,module,exports){
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


},{"./DiHelper":17}],22:[function(require,module,exports){
module.exports = {
  Injector: require('./Injector'),
  InjectorFactory: require('./InjectorFactory'),
  InjectorExtension: require('./InjectorExtension')
};


},{"./Injector":18,"./InjectorExtension":19,"./InjectorFactory":20}],23:[function(require,module,exports){
var CookieManager, CookieSection;

CookieSection = require('./CookieSection');

CookieManager = (function() {
  CookieManager.prototype.document = null;

  CookieManager.prototype.options = null;

  function CookieManager(options) {
    if (options == null) {
      options = {};
    }
    this.document = document;
    this.options = options;
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


},{"./CookieSection":24}],24:[function(require,module,exports){
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
    return (this.items[name] !== void 0 ? this.items[name] : def);
  };

  CookieSection.prototype.has = function(name) {
    return this.items[name] !== void 0;
  };

  CookieSection.prototype.each = function(callback) {
    Object.each(this.items, callback);
  };

  return CookieSection;

})();

module.exports = CookieSection;


},{}],25:[function(require,module,exports){
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
    HttpRequest.__super__.constructor.call(this, Object.merge(options, {
      data: {}
    }));
    this.initRequest();
  }

  HttpRequest.prototype.initRequest = function() {
    this.setHeader("Accept", "application/json");
    this.setHeader("X-Request", "JSON");
  };

  HttpRequest.prototype.success = function(text) {
    var json;
    json = this.processJson(text);
    if (!json) {
      this.onFailure(null, text);
    } else {
      this.onSuccess(json, text);
    }
  };

  HttpRequest.prototype.failure = function() {
    var json;
    json = this.processJson(this.response.text);
    this.onFailure(json, this.response.text);
  };

  HttpRequest.prototype.processJson = function(text) {
    var error, json;
    try {
      json = JSON.decode(text, this.options.secure);
      this.response.json = json;
      return json;
    } catch (_error) {
      error = _error;
      this.emit("error", text, error);
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


},{}],26:[function(require,module,exports){
var HttpRequest, MiwoObject, RequestManager,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

MiwoObject = require('../core/Object');

HttpRequest = require('./HttpRequest');

RequestManager = (function(_super) {
  __extends(RequestManager, _super);

  function RequestManager() {
    return RequestManager.__super__.constructor.apply(this, arguments);
  }

  RequestManager.prototype.params = {};

  RequestManager.prototype.plugins = {};

  RequestManager.prototype.createRequest = function(options) {
    var request;
    request = new HttpRequest(options);
    this.manage(request);
    return request;
  };

  RequestManager.prototype.get = function(options) {
    var request;
    request = this.createRequest(options);
    request.get();
    return request;
  };

  RequestManager.prototype.post = function(options) {
    var request;
    request = this.createRequest(options);
    request.post();
    return request;
  };

  RequestManager.prototype.read = function(url) {
    var data, request;
    data = null;
    request = new Request({
      url: url,
      async: false,
      onSuccess: function(response) {
        return data = response;
      },
      onFailure: function() {
        throw new Error("Can't load data from url " + url);
      }
    });
    request.send();
    return data;
  };

  RequestManager.prototype.manage = function(request) {
    if (request.manager) {
      return;
    }
    request.manager = this;
    request.on("success", (function(_this) {
      return function(json) {
        _this.emit("success", request, json);
      };
    })(this));
    request.on("failure", (function(_this) {
      return function() {
        _this.emit("failure", request);
      };
    })(this));
    request.on("error", (function(_this) {
      return function(text, error) {
        _this.emit("error", request, text, error);
      };
    })(this));
  };

  RequestManager.prototype.register = function(name, plugin) {
    if (this.plugins[name]) {
      throw new Error("Plugin with name " + name + " already registered");
    }
    this.plugins[name] = plugin;
    plugin.setManager(this);
  };

  return RequestManager;

})(MiwoObject);

module.exports = RequestManager;


},{"../core/Object":14,"./HttpRequest":25}],27:[function(require,module,exports){
module.exports = {
  HttpRequest: require('./HttpRequest'),
  RequestManager: require('./RequestManager')
};


},{"./HttpRequest":25,"./RequestManager":26}],28:[function(require,module,exports){
var ErrorPlugin, FailurePlugin, RedirectPlugin;

RedirectPlugin = (function() {
  function RedirectPlugin() {}

  RedirectPlugin.prototype.setManager = function(manager) {
    manager.on('success', function(request, response) {
      if (response.redirect) {
        return document.location = response.redirect;
      }
    });
  };

  return RedirectPlugin;

})();

FailurePlugin = (function() {
  function FailurePlugin() {}

  FailurePlugin.prototype.setManager = function(manager) {
    manager.on('failure', function(request) {
      return miwo.flash.error(request.xhr.statusText + ": " + request.xhr.responseText.replace(/(<([^>]+)>)/g, ""));
    });
  };

  return FailurePlugin;

})();

ErrorPlugin = (function() {
  function ErrorPlugin() {}

  ErrorPlugin.prototype.setManager = function(manager) {
    manager.on('error', function(request, text, error) {
      return console.error("Error in ajax request", request);
    });
  };

  return ErrorPlugin;

})();

module.exports = {
  RedirectPlugin: RedirectPlugin,
  FailurePlugin: FailurePlugin,
  ErrorPlugin: ErrorPlugin
};


},{}],29:[function(require,module,exports){
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
},{"./DiExtension":2,"./bootstrap/Miwo":4,"./component":10,"./core":16,"./core/Common":11,"./core/Element":12,"./core/Types":15,"./di":22,"./http":27,"./locale":37,"./utils":41}],30:[function(require,module,exports){
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


},{"./Layout":34}],31:[function(require,module,exports){
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


},{"./Layout":34}],32:[function(require,module,exports){
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


},{"./Layout":34}],33:[function(require,module,exports){
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


},{"./Layout":34}],34:[function(require,module,exports){
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
    if (component.width) {
      component.el.setStyle('width', component.width);
    }
    if (component.height) {
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


},{"../core/Object":14}],35:[function(require,module,exports){
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


},{"./Absolute":30,"./Auto":31,"./Fit":32,"./Form":33,"./Layout":34}],36:[function(require,module,exports){
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


},{}],37:[function(require,module,exports){
module.exports = {
  Translator: require('./Translator')
};


},{"./Translator":36}],38:[function(require,module,exports){
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


},{}],39:[function(require,module,exports){
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


},{}],40:[function(require,module,exports){
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
    this.emit("close");
    this.target.removeClass("miwo-overlayed");
    this.overlay.setStyle("opacity", 0.0);
    ((function(_this) {
      return function() {
        return _this.overlay.setStyle("display", "none");
      };
    })(this)).delay(300);
    this.emit("hide");
  };

  Overlay.prototype.doDestroy = function() {
    this.overlay.destroy();
    Overlay.__super__.doDestroy.call(this);
  };

  return Overlay;

})(MiwoObject);

module.exports = Overlay;


},{"../core/Object":14}],41:[function(require,module,exports){
module.exports = {
  Overlay: require('./Overlay'),
  Collection: require('./Collection'),
  KeyListener: require('./KeyListener')
};


},{"./Collection":38,"./KeyListener":39,"./Overlay":40}]},{},[29])