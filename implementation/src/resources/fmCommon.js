/**
 * Copyright (c) 2014, Jose Enrique Bolanos, Jorge Villalobos
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *  * Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *  * Neither the name of Jose Enrique Bolanos, Jorge Villalobos nor the names
 *    of its contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER
 * OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 **/

var EXPORTED_SYMBOLS = [ "FireFM" ];

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/Log.jsm");

/**
 * FireFM namespace.
 */
if (typeof(FireFM) == 'undefined') {
  var FireFM = {
    /* The Fire.fm extension UUID */
    get EXTENSION_UUID() { return "{6F0976E6-26F3-4AFE-BBEC-9E99E27E4DF3}"; },
    /* The root branch for all Fire.FM preferences. */
    get PREF_BRANCH() { return "extensions.firefm."; },
    /* Platform constants */
    get OS_WINDOWS()       { return 0; },
    get OS_WINDOWS_VISTA() { return 1; },
    get OS_MAC()           { return 2; },
    get OS_LINUX()         { return 3; },
    get OS_OTHER()         { return 4; },

    /* The logger for this object. */
    _logger : null,
    /* The FUEL Application object. */
    _application : null,
    /* Identifier for the operating system */
    _os : null,
    /* Reference to the observer service. We use this one a lot. */
    obsService : null,
    /* Flag used to control the chrome startup process. */
    startupDone : false,
    /* Flag used to control if autoplay has been tried already. */
    autoplayDone : false,
    /* Overlay string bundle. */
    overlayBundle : null,
    /* Array of timer references, keeps intervals alive. */
    _timers : [],

    /**
     * Initialize this object.
     */
    init : function() {
      let formatter = new BasicButNotUglyFormatter();
      let logFile = this.getFMDirectory();
      let appender;

      this._logger = Log.repository.getLogger("FireFM");

      logFile.append("log.txt");
      // this appender will log to the file system.
      appender = new Log.BoundedFileAppender(logFile.path, formatter);

      this._logger.level = Log.Level.All;
      appender.level = Log.Level.Warn; // change this to adjust level.
      this._logger.addAppender(appender);
      this._logger.debug("init");

      this.obsService =
        Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
      this.overlayBundle =
        Cc["@mozilla.org/intl/stringbundle;1"].
          getService(Ci.nsIStringBundleService).
            createBundle("chrome://firefm/locale/fmBrowserOverlay.properties");
    },

    /**
     * Gets the FUEL Application object.
     */
    get Application() {
      if (null == this._application) {
        if (null != Cc["@mozilla.org/fuel/application;1"]) {
          // Firefox and Flock.
          this._application =
            Cc["@mozilla.org/fuel/application;1"].
              getService(Ci.fuelIApplication);
        } else if (null != Cc["@mozilla.org/smile/application;1"]) {
          // SeaMonkey.
          this._application =
            Cc["@mozilla.org/smile/application;1"].
              getService(Ci.smileIApplication);
        } else {
          // Other?
          this._logger.fatal(
            "get Application: Couldn't load FUEL or equivalent.");
        }
      }

      return this._application;
    },

    /**
     * Creates a logger repository from Log4Moz.
     * @param aName the name of the logger to create.
     * @param aLevel (optional) the logger level.
     * @return the created logger.
     */
    getLogger : function(aName, aLevel) {
      let logger = Log.repository.getLogger(aName);

      logger.level = (aLevel ? Log.Level[aLevel] : Log.Level.All);
      logger.parent = this._logger;

      return logger;
    },

    /**
     * Gets a reference to the directory where Fire.fm will keep its files. The
     * directory is created if it doesn't exist.
     * @return reference (nsIFile) to the Fire.fm directory.
     */
    getFMDirectory : function() {
      // XXX: there's no logging here because the logger initialization depends
      // on this method.

      let directoryService =
        Cc["@mozilla.org/file/directory_service;1"].
          getService(Ci.nsIProperties);
      let fmDir = directoryService.get("ProfD", Ci.nsIFile);

      fmDir.append("firefm");

      if (!fmDir.exists() || !fmDir.isDirectory()) {
        // read and write permissions to owner and group, read-only for others.
        fmDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0774);
      }

      return fmDir;
    },

    /**
     * Encodes strings in the way Last.fm usually encodes them, which includes
     * replacing space characters for + characters.
     * @param aString the string to encode.
     * @return the encoded string.
     */
    encodeFMString : function(aString) {
      this._logger.debug("encodeFMString");

      if (null == aString) {
        this._logger.error("encodeFMString. Invalid string.");
        throw new Ce("Invalid string.");
      }

      return encodeURIComponent(aString).replace(/\%20/g, "+");
    },

    /**
     * Decodes strings in the way Last.fm usually encodes them, which includes
     * replacing space characters for + characters.
     * @param aString the string to decode.
     * @return the decoded string.
     */
    decodeFMString : function(aString) {
      this._logger.debug("decodeFMString");

      if (null == aString) {
        this._logger.error("decodeFMString. Invalid string.");
        throw new Ce("Invalid string.");
      }

      return decodeURIComponent(aString.replace(/\+/g, " "));
    },

    /**
     * Creates a nsIURI object from the given URL.
     * @param aURL The URL used to create the nsIURI object.
     * @return The nsIURI object if aURL is valid, otherwise null.
     */
    createURI : function(aURL) {
      this._logger.debug("createURI");

      var uri = null;

      try {
        uri =
          Cc["@mozilla.org/network/io-service;1"].
            getService(Ci.nsIIOService).newURI(aURL, null, null);
      } catch (e) {
        this._logger.debug("createURI. Error:\n" + e);
      }

      return uri;
    },

    /**
     * Sends an HTTP request.
     * @param aURL the url to send the request to.
     * @param aLoadHandler the load callback handler. Can be null.
     * @param aErrorHandler the error callback handler. Can be null.
     * @param aHeaders object mapping that represents the headers to send. Can
     * be null or empty.
     * @param aIsPOST indicates if the method POST (true) or GET (false).
     * @param aPOSTString the string or stream to send through post (optional).
     */
    sendRequest : function(
      aURL, aLoadHandler, aErrorHandler, aHeaders, aIsPOST, aPOSTString) {
      this._logger.debug("sendRequest");

      let request =
        Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();

      // add event handlers.
      request.QueryInterface(Ci.nsIDOMEventTarget);

      if (null != aLoadHandler) {
        request.addEventListener("load", aLoadHandler, false);
      }

      if (null != aErrorHandler) {
        request.addEventListener("error", aErrorHandler, false);
      }

      // prepare and send the request.
      request.QueryInterface(Ci.nsIXMLHttpRequest);
      request.open((aIsPOST ? "POST" : "GET"), aURL, true);

      if (null != aHeaders) {
        for (let header in aHeaders) {
          request.setRequestHeader(header, aHeaders[header]);
        }
      }

      if (aIsPOST) {
        request.send(aPOSTString);
      } else {
        request.send(null);
      }
    },

    /**
     * Converts the given string into a UTF-8 string that can be sent through POST
     * as if it were binary. This is required for several Last.fm calls.
     * @param aString the string to convert into a stream.
     * @return nsIInputStream for the given string.
     */
    convertToStream : function(aString) {
      this._logger.debug("convertToStream");

      let multiStream =
        Cc["@mozilla.org/io/multiplex-input-stream;1"].
          createInstance(Ci.nsIMultiplexInputStream);
      let converter =
        Cc["@mozilla.org/intl/scriptableunicodeconverter"].
          createInstance(Ci.nsIScriptableUnicodeConverter);
      let inputStream;

      converter.charset = "UTF-8";
      inputStream = converter.convertToInputStream(aString);
      multiStream.appendStream(inputStream);

      return multiStream;
    },

    /**
     * Obtains an identifier for the operating system this extension is running
     * on.
     * @return One of the operating system constants defined in this object.
     */
    getOperatingSystem : function() {
      this._logger.debug("getOperatingSystem");

      if (null == this._os) {
        const REGEX_OS_WINDOWS = /^Win/i;
        const REGEX_OS_MAC = /^Mac/i;
        const REGEX_OS_LINUX = /^Linux/i;
        const REGEX_OS_WINDOWS_VISTA = /Windows NT 6.0/i;

        let appShellService =
          Cc["@mozilla.org/appshell/appShellService;1"].
            getService(Ci.nsIAppShellService);
        let navigator = appShellService.hiddenDOMWindow.navigator;
        let platform = navigator.platform;


        if (platform.match(REGEX_OS_MAC)) {
          this._os = this.OS_MAC;
        } else if (platform.match(REGEX_OS_WINDOWS)) {
          let userAgent = navigator.userAgent;

          if (userAgent.match(REGEX_OS_WINDOWS_VISTA)) {
            this._os = this.OS_WINDOWS_VISTA;
          } else {
            this._os = this.OS_WINDOWS;
          }
        } else if (platform.match(REGEX_OS_LINUX)) {
          this._os = this.OS_LINUX;
        } else {
          this._os = this.OS_OTHER;
        }
      }

      return this._os;
    },

    /**
     * Timeout function equivalent to "set timeout". It uses nsITimer behind the
     * scenes.
     * @param aFunction the function to run after the timeout.
     * @param aDelay the time in milliseconds to wait before firing the
     * function.
     * @return the nsITimer instance that can be canceled.
     */
    runWithDelay : function (aFunction, aDelay) {
      this._logger.debug("runWithDelay");

      let timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);

      timer.initWithCallback(
        { notify : aFunction }, aDelay, Ci.nsITimer.TYPE_ONE_SHOT);
      this._timers.push(timer);

      return timer;
    },

    /**
     * Obtains the wrapped JS object from an XPCOM component. We use this a lot
     * to unwrap parameter we send through observers.
     * @param aWrappedObject the object to unwrap.
     * @return the unwrapped object.
     */
    unwrap : function(aWrappedObject) {
      this._logger.debug("unwrap");

      return aWrappedObject.wrappedJSObject;
    }
  };
}

// Basic log formatter that shows decent dates.
function BasicButNotUglyFormatter(aDateFormat) {
  if (aDateFormat) {
    this.dateFormat = aDateFormat;
  }
}
BasicButNotUglyFormatter.prototype = {
  _dateFormat : null,

  get dateFormat() {
    if (!this._dateFormat) {
      this._dateFormat = "%Y-%m-%d %H:%M:%S";
    }

    return this._dateFormat;
  },

  set dateFormat(aFormat) {
    this._dateFormat = aFormat;
  },

  format: function(aMessage) {
    let date = new Date(aMessage.time);

    return date.toLocaleFormat(this.dateFormat) + "\t" +
      aMessage.loggerName + "\t" + aMessage.levelDesc + "\t" +
      aMessage.message + "\n";
  }
};

/**
 * FireFM constructor. This sets up logging for the rest of the extension.
 */
(function() {
  this.init();
}).apply(FireFM);
