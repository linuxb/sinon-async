/**
 * Stub behavior
 *
 * @author Christian Johansen (christian@cjohansen.no)
 * @author Tim Fischbach (mail@timfischbach.de)
 * @author Linuxb
 * @license BSD
 *
 * Copyright (c) 2010-2013 Christian Johansen
 */
"use strict";

var extend = require("./extend");
var functionName = require("./util/core/function-name");
var valueToString = require("./util/core/value-to-string");

var slice = Array.prototype.slice;
var join = Array.prototype.join;
var useLeftMostCallback = -1;
var useRightMostCallback = -2;

var nextTick = (function () {
    if (typeof process === "object" && typeof process.nextTick === "function") {
        return process.nextTick;
    }

    if (typeof setImmediate === "function") {
        return setImmediate;
    }

    return function (callback) {
        setTimeout(callback, 0);
    };
})();

function throwsException(error, message) {
    if (typeof error === "string") {
        this.exception = new Error(message || "");
        this.exception.name = error;
    } else if (!error) {
        this.exception = new Error("Error");
    } else {
        this.exception = error;
    }

    return this;
}

function getCallback(behavior, args) {
    var callArgAt = behavior.callArgAt;

    if (callArgAt >= 0) {
        return args[callArgAt];
    }

    var argumentList;

    if (callArgAt === useLeftMostCallback) {
        argumentList = args;
    }

    if (callArgAt === useRightMostCallback) {
        argumentList = slice.call(args).reverse();
    }

    var callArgProp = behavior.callArgProp;

    for (var i = 0, l = argumentList.length; i < l; ++i) {
        if (!callArgProp && typeof argumentList[i] === "function") {
            return argumentList[i];
        }

        if (callArgProp && argumentList[i] &&
            typeof argumentList[i][callArgProp] === "function") {
            return argumentList[i][callArgProp];
        }
    }

    return null;
}

function getCallbackError(behavior, func, args) {
    if (behavior.callArgAt < 0) {
        var msg;

        if (behavior.callArgProp) {
            msg = functionName(behavior.stub) +
                " expected to yield to '" + valueToString(behavior.callArgProp) +
                "', but no object with such a property was passed.";
        } else {
            msg = functionName(behavior.stub) +
                " expected to yield, but no callback was passed.";
        }

        if (args.length > 0) {
            msg += " Received [" + join.call(args, ", ") + "]";
        }

        return msg;
    }

    return "argument at index " + behavior.callArgAt + " is not a function: " + func;
}

function callCallback(behavior, args) {
    if (typeof behavior.callArgAt === "number") {
        var func = getCallback(behavior, args);

        if (typeof func !== "function") {
            throw new TypeError(getCallbackError(behavior, func, args));
        }
        var props = behavior.hookProps;
        if (behavior.callbackAsync) {
            nextTick(function () {
                func.apply(behavior.callbackContext, behavior.callbackArguments);
            });
        } else if (behavior.callAsyncHook && props) {
            var hookContext = props.callbackContext;
            var hookArgs = props.args;
            var hookCallback = behavior.callAsyncHook;
            //promise supported
            if(props.promisified) {
                var promise = hookCallback.apply(hookContext,hookArgs);
                if(typeof promise.then !== 'function') throw new TypeError('result of callback hooked is not a promise');
                promise.then(function (res) {
                    //res maybe a interceptors
                    if(res && Array.isArray(res)) {
                        res.forEach(function (injector) {
                            if ( !injector || !'pos' in injector || !'value' in injector || typeof injector.pos !== 'number' ) {
                                return;
                            }
                            behavior.callbackArguments[injector.pos] = injector.value;
                        });
                    }
                    if (props.timeout) {
                        setTimeout(function () {
                            func.apply(behavior.callbackContext, behavior.callbackArguments);
                        },props.timeout);
                    } else {
                        func.apply(behavior.callbackContext, behavior.callbackArguments);
                    }
                },function (err) {
                    throw err;
                }).catch(function (ex) {
                    throw ex;
                });
                return;
            }
            //interceptor for send message to the real callback
            //inject argument to specified position to callback
            var interceptors = hookCallback.apply(hookContext,hookArgs);
            if (interceptors && Array.isArray(interceptors)) {
                interceptors.forEach(function (injector) {
                    if ( !injector || !'pos' in injector || !'value' in injector || typeof injector.pos !== 'number' ) {
                        return;
                    }
                    behavior.callbackArguments[injector.pos] = injector.value;
                });
            }
            //should be delay before being invoked
            if (props.timeout) {
                setTimeout(function () {
                    func.apply(behavior.callbackContext, behavior.callbackArguments);
                },props.timeout);
            } else {
                func.apply(behavior.callbackContext, behavior.callbackArguments);
            }
        } else {
            func.apply(behavior.callbackContext, behavior.callbackArguments);
        }
    }
}

var proto = {
    create: function create(stub) {
        var behavior = extend({}, proto);
        delete behavior.create;
        behavior.stub = stub;

        return behavior;
    },

    isPresent: function isPresent() {
        return (typeof this.callArgAt === "number" ||
                this.exception ||
                typeof this.returnArgAt === "number" ||
                this.returnThis ||
                this.returnValueDefined);
    },

    //add some async hook to build sandbox for IO operations
    setBeforeCallbackHook: function (hook, options) {
        if (!hook || typeof hook !== 'function') throw new TypeError('hook must be a function');
        this.hookProps = {};
        this.callAsyncHook = hook;
        this.hookProps.promisified = false;
        if (options) {
            extend(this.hookProps,options);
            //expect more behaviors in options
        }
        return this;
    },

    yieldsBeforeCallbackHook: function (context) {
        if (!this.hookProps || !this.callAsyncHook) throw new TypeError('can not yields hook without register it');
        this.hookProps.args = slice.call(arguments,1);
        this.hookProps.callbackContext = context || this;
        return this;
    },

    invoke: function invoke(context, args) {
        callCallback(this, args);

        if (this.exception) {
            throw this.exception;
        } else if (typeof this.returnArgAt === "number") {
            return args[this.returnArgAt];
        } else if (this.returnThis) {
            return context;
        }

        return this.returnValue;
    },

    onCall: function onCall(index) {
        return this.stub.onCall(index);
    },

    onFirstCall: function onFirstCall() {
        return this.stub.onFirstCall();
    },

    onSecondCall: function onSecondCall() {
        return this.stub.onSecondCall();
    },

    onThirdCall: function onThirdCall() {
        return this.stub.onThirdCall();
    },

    withArgs: function withArgs(/* arguments */) {
        throw new Error(
            "Defining a stub by invoking \"stub.onCall(...).withArgs(...)\" " +
            "is not supported. Use \"stub.withArgs(...).onCall(...)\" " +
            "to define sequential behavior for calls with certain arguments."
        );
    },

    callsArg: function callsArg(pos) {
        if (typeof pos !== "number") {
            throw new TypeError("argument index is not number");
        }

        this.callArgAt = pos;
        this.callbackArguments = [];
        this.callbackContext = undefined;
        this.callArgProp = undefined;
        this.callbackAsync = false;

        return this;
    },

    callsArgOn: function callsArgOn(pos, context) {
        if (typeof pos !== "number") {
            throw new TypeError("argument index is not number");
        }

        this.callArgAt = pos;
        this.callbackArguments = [];
        this.callbackContext = context;
        this.callArgProp = undefined;
        this.callbackAsync = false;

        return this;
    },

    callsArgWith: function callsArgWith(pos) {
        if (typeof pos !== "number") {
            throw new TypeError("argument index is not number");
        }

        this.callArgAt = pos;
        this.callbackArguments = slice.call(arguments, 1);
        this.callbackContext = undefined;
        this.callArgProp = undefined;
        this.callbackAsync = false;

        return this;
    },

    callsArgOnWith: function callsArgWith(pos, context) {
        if (typeof pos !== "number") {
            throw new TypeError("argument index is not number");
        }

        this.callArgAt = pos;
        this.callbackArguments = slice.call(arguments, 2);
        this.callbackContext = context;
        this.callArgProp = undefined;
        this.callbackAsync = false;

        return this;
    },

    yields: function () {
        this.callArgAt = useLeftMostCallback;
        this.callbackArguments = slice.call(arguments, 0);
        this.callbackContext = undefined;
        this.callArgProp = undefined;
        this.callbackAsync = false;

        return this;
    },

    yieldsRight: function () {
        this.callArgAt = useRightMostCallback;
        this.callbackArguments = slice.call(arguments, 0);
        this.callbackContext = undefined;
        this.callArgProp = undefined;
        this.callbackAsync = false;

        return this;
    },

    yieldsOn: function (context) {
        this.callArgAt = useLeftMostCallback;
        this.callbackArguments = slice.call(arguments, 1);
        this.callbackContext = context;
        this.callArgProp = undefined;
        this.callbackAsync = false;

        return this;
    },

    yieldsTo: function (prop) {
        this.callArgAt = useLeftMostCallback;
        this.callbackArguments = slice.call(arguments, 1);
        this.callbackContext = undefined;
        this.callArgProp = prop;
        this.callbackAsync = false;

        return this;
    },

    yieldsToOn: function (prop, context) {
        this.callArgAt = useLeftMostCallback;
        this.callbackArguments = slice.call(arguments, 2);
        this.callbackContext = context;
        this.callArgProp = prop;
        this.callbackAsync = false;

        return this;
    },

    throws: throwsException,
    throwsException: throwsException,

    returns: function returns(value) {
        this.returnValue = value;
        this.returnValueDefined = true;
        this.exception = undefined;

        return this;
    },

    returnsArg: function returnsArg(pos) {
        if (typeof pos !== "number") {
            throw new TypeError("argument index is not number");
        }

        this.returnArgAt = pos;

        return this;
    },

    returnsThis: function returnsThis() {
        this.returnThis = true;

        return this;
    }
};

function createAsyncVersion(syncFnName) {
    return function () {
        var result = this[syncFnName].apply(this, arguments);
        this.callbackAsync = true;
        return result;
    };
}

// create asynchronous versions of callsArg* and yields* methods
for (var method in proto) {
    // need to avoid creating anotherasync versions of the newly added async methods
    if (proto.hasOwnProperty(method) && method.match(/^(callsArg|yields)/) && !method.match(/Async/)) {
        proto[method + "Async"] = createAsyncVersion(method);
    }
}

module.exports = proto;
