/**
 * Copyright (c) 2008-2011, Jose Enrique Bolanos, Jorge Villalobos
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

var EXPORTED_SYMBOLS = [];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Ce = Components.Exception;

Components.utils.import("resource://firefm/fmCommon.js");
Components.utils.import("resource://firefm/fmPlayer.js");

// NoScript service name.
const NOSCRIPT_SERVICE = "@maone.net/noscript-service;1";

/**
 * FireFM Player Initializer. Performs all the flash player intialization tasks.
 */
FireFM.PlayerInitializer = {

  /* Logger for this object */
  _logger : null,
  /* Holds the exception that may have been thrown during initialization */
  _initializationException : null,
  /* Indicates if the permissions file has been set. */
  _permissionsSet : false,
  /* Preference object that holds the current volume setting. */
  _volumePref : null,

  /**
   * Initializes the object.
   */
  init : function() {
    let that = this;

    this._logger = FireFM.getLogger("FireFM.PlayerInitializer");
    this._logger.debug("init");
    this._volumePref =
      FireFM.Application.prefs.get(FireFM.PREF_BRANCH + "volumeLevel");
  },

  /**
   * Obtains the exception that may have been thrown during the flash player
   * initialization. Null if no exception was thrown.
   */
  get initializationException() {
    this._logger.debug("initializationException[get]");
    return this._initializationException;
  },

  /**
   * Initializes the flash object needed to play mp3 files.
   * @param aCallback the function to call once the player has been initialized.
   */
  initializePlayer : function(aCallback) {
    this._logger.debug("initializePlayer");

    let that = this;

    // Firefox 4 has an asynchronous add-ons manager.
    if (null != FireFM.Application.getExtensions) {
      FireFM.Application.getExtensions(
        function(extensions) {
          that._initializePlayer2(extensions, aCallback); });
    } else {
      this._initializePlayer2(FireFM.Application.extensions, aCallback);
    }
  },

  /**
   * Second stage of the player initialization, after the possible asynchronous
   * extension data request.
   * @param aCallback the function to call once the player has been initialized.
   */
  _initializePlayer2 : function(aExtensions, aCallback) {
    this._logger.trace("_initializePlayer2");

    // UUIDs of extensions that interfere with Fire.fm
    const FLASHBLOCK_UUID = "{3d7eb24f-2740-49df-8937-200b1cc08f8a}";
    const STOPAUTOPLAY_UUID = "{2e61e246-e640-4c56-b1ed-f146dbed48cd}";
    const MEDIAWRAP_UUID = "{dd68c513-9296-4b63-8d8b-8f1c991c8a48}";

    try {
      // test error line. Comment out on releases!
      //null.hello;

      // check if the Flash player plugin is present.
      if (this._detectFlashPlugin()) {
        let flashURL = this._getFlashURL();
        let flashObject;

        // create the Flash permissions file if necessary.
        if (!this._permissionsSet) {
          this._installPermissionFile(flashURL);
        }

        // override add-ons that can prevent the player from working.
        if (NOSCRIPT_SERVICE in Cc) {
          this._overrideNoscript(flashURL);
        }

        // these add-ons use bindings with CSS in order to change embed
        // elements. We use our own CSS to override them.
        if (this._isExtensionInstalled(aExtensions, FLASHBLOCK_UUID) ||
            this._isExtensionInstalled(aExtensions, STOPAUTOPLAY_UUID) ||
            this._isExtensionInstalled(aExtensions, MEDIAWRAP_UUID)) {
          this._overrideFlashCSS();
        }

        // inject the Flash object in the hidden DOM window.
        flashObject = this._injectFlash(flashURL);
        // XXX: security wrapper juju.
        if (null != flashObject.wrappedJSObject) {
          flashObject = flashObject.wrappedJSObject;
        }
        // finally, check if the player has loaded correctly.
        this._testPlayer(flashObject, 1, aCallback);
      } else {
        this._logger.warn("Flash plugin missing");
        FireFM.obsService.notifyObservers(
          null, FireFM.Player.TOPIC_PLAYER_ERROR,
          FireFM.Player.STATUS_PLUGIN_MISSING);
      }
    } catch (e) {
      this._logger.fatal("_initializePlayer2. Initialization failed:\n" + e);
      this._initializationException = e;
      FireFM.obsService.notifyObservers(
        null, FireFM.Player.TOPIC_PLAYER_ERROR,
        FireFM.Player.STATUS_LOAD_ERROR);
    }
  },

  /**
   * Detects if the flash player plugin is installed, enabled, and of the
   * required version.
   * @return True of the plugin meets the requirements, false otherwise.
   */
  _detectFlashPlugin : function() {
    this._logger.trace("_detectFlashPlugin");

    // Minimum flash version supported
    const MIN_FLASH_VERSION = 8;

    let plugin =
      Cc["@mozilla.org/appshell/appShellService;1"].
        getService(Ci.nsIAppShellService).hiddenDOMWindow.
          navigator.mimeTypes["application/x-shockwave-flash"];
    // Regular expression to obtain the flash plugin version from its
    // description.
    let versionRE = new RegExp("([0-9]+)[^0-9]", "g");
    let isValidPlugin = false;

    if (plugin && plugin.enabledPlugin && plugin.enabledPlugin.description) {
      let match = versionRE.exec(plugin.enabledPlugin.description);

      if (match && match.length > 0) {
        isValidPlugin = (MIN_FLASH_VERSION <= parseInt(match[1]));
      }
    }

    return isValidPlugin;
  },

  /**
   * Obtains the URL of the flash player, located in the extension's default
   * folder.
   * @return The URL of the flash player.
   */
  _getFlashURL : function() {
    this._logger.trace("_getFlashURL");

    // Flash file name
    const FLASH_FILE_NAME = "firefm.swf";
    let flashURL;

    let directoryService =
      Cc["@mozilla.org/file/directory_service;1"].
        getService(Ci.nsIProperties);
    let flashFile = directoryService.get("ProfD", Ci.nsIFile);

    flashFile.append("extensions");
    flashFile.append(FireFM.EXTENSION_UUID);
    flashFile.append("defaults");
    flashFile.append(FLASH_FILE_NAME);

    flashURL =
      Cc["@mozilla.org/network/protocol;1?name=file"].
        getService(Ci.nsIFileProtocolHandler).getURLSpecFromFile(flashFile);

    return flashURL;
  },

  /**
   * Installs the permission file required for the embedded flash object to
   * connect to the Internet. If the permission file and entry already exist
   * then the file is not altered.
   * @param aFlashURL The URL of the flash player, used in the permission file.
   */
  _installPermissionFile : function(aFlashURL) {
    this._logger.trace("_installPermissionFile");

    let permissionFile = this._getPermissionFile();

    let data =
      "resource://gre/res/hiddenWindow.html\n" +
      "chrome://browser/content/hiddenWindow.xul\n" +
      "chrome://navigator/content/hiddenWindow.xul\n" +
      decodeURIComponent(aFlashURL);
    let foStream =
      Cc["@mozilla.org/network/file-output-stream;1"].
        createInstance(Ci.nsIFileOutputStream);
    let coStream =
      Cc["@mozilla.org/intl/converter-output-stream;1"].
        createInstance(Ci.nsIConverterOutputStream);

    // write, create, truncate
    foStream.init(permissionFile, 0x02 | 0x08 | 0x20, 0666, 0);
    coStream.init(foStream, "UTF-8", 0, 0);
    coStream.writeString(data);
    coStream.close();
    foStream.close();

    this._logger.debug("Flash permission file written");
    this._permissionsSet = true;
  },

  /**
   * Obtains a reference to the flash permission file.
   * @return The file permission file reference.
   */
  _getPermissionFile : function() {
    this._logger.trace("_getPermissionFile");

    // Name of the permission file
    const PERMISSION_FILE_NAME = "firefm.cfg";
    // Strings passed to the directory service to obtain the application data
    // folder on each OS
    const LOCATIONS = [
      "AppData", // Windows
      "UsrPrfs", // Mac
      "Home" // Unix
    ];
    // Directory path to the permission file for each OS
    const DIR_PATH = [
      // Windows
      ["Macromedia", "Flash Player", "#Security", "FlashPlayerTrust"],
      // Mac
      ["Macromedia", "Flash Player", "#Security", "FlashPlayerTrust"],
      // Unix
      [".macromedia", "Flash_Player", "#Security", "FlashPlayerTrust"]
    ];

    let osIndex = 2;

    switch (FireFM.getOperatingSystem()) {
      case FireFM.OS_WINDOWS:
      case FireFM.OS_WINDOWS_VISTA:
        osIndex = 0;
        break;
      case FireFM.OS_MAC:
        osIndex = 1;
        break;
    }

    let file =
      Cc["@mozilla.org/file/directory_service;1"].
        getService(Ci.nsIProperties).
          get(LOCATIONS[osIndex], Ci.nsIFile);

    // Move towards target path
    for (let i = 0; i < DIR_PATH[osIndex].length; i++) {
      file.append(DIR_PATH[osIndex][i]);

      if (!file.exists() || !file.isDirectory()) {
        file.create(Ci.nsIFile.DIRECTORY_TYPE, 0777);
      }
    }

    file.append(PERMISSION_FILE_NAME);

    return file;
  },

  /**
   * Injects the embedded flash player object needed to play mp3 files in the
   * hidden window.
   * @param aFlashURL The URL from where to load the flash player.
   */
  _injectFlash : function(aFlashURL) {
    this._logger.trace("_injectFlash");

    let win =
      Cc["@mozilla.org/appshell/appShellService;1"].
        getService(Ci.nsIAppShellService).hiddenDOMWindow;
    let doc = win.document;

    // clear pre-existing node if necessary.
    let playerObj = doc.getElementById("firefm-player");

    if (null != playerObj) {
      playerObj.parentNode.removeChild(playerObj);
      playerObj = null;
      win.onFireFMSoundLoad = null;
      win.onFireFMSoundComplete = null;
    }

    // create the node and insert it.
    playerObj =
      doc.createElementNS("http://www.w3.org/1999/xhtml", "embed");
    playerObj.setAttribute("src", aFlashURL);
    playerObj.setAttribute("type", "application/x-shockwave-flash");
    playerObj.setAttribute("id", "firefm-player");
    playerObj.setAttribute("name", "firefm-player");
    playerObj.setAttribute("FlashVars", "id='firefm-player'");
    playerObj.setAttribute("allowScriptAccess", "always");
    playerObj.setAttribute("allowNetworking", "all");
    playerObj.setAttribute("quality", "high");

    doc.documentElement.appendChild(playerObj);

    return playerObj;
  },

  /**
   * Tests the player object the make sure it loaded correctly.
   * @param aFlashObject the Flash object to test.
   * @param aTry the amount of tries for this test. After MAX_TRIES the player
   * is considered to have failed to load.
   * @param aCallback the function to call once the player has been initialized.
   */
  _testPlayer : function(aFlashObject, aTry, aCallback) {
    this._logger.trace("_testPlayer");

    const MAX_TRIES = 40;
    const TRY_DELAY = 300;

    if (null != aFlashObject.stop) {
      try {
        let win = aFlashObject.ownerDocument.defaultView;

        // add event listeners to flash object.
        win.onFireFMSoundLoad = function(aId, aSuccess) {
          FireFM.Player.onTrackLoaded(aSuccess);
        };

        win.onFireFMSoundComplete = function(aId) {
          FireFM.Player.onTrackFinished();
        };

        this._logger.info("Flash player initialized successfully");
        FireFM.Player.setPlayer(aFlashObject);
        FireFM.Player.setVolume(this._volumePref.value);
        aCallback();
      } catch (e) {
        this._logger.fatal("_testPlayer. Flash player startup failed.");
        this._initializationException = e;
        FireFM.obsService.notifyObservers(
          null, FireFM.Player.TOPIC_PLAYER_ERROR,
          FireFM.Player.STATUS_LOAD_ERROR);
      }
    } else {
      if (aTry < MAX_TRIES) {
        let that = this;

        FireFM.runWithDelay(
          function() { that._testPlayer(aFlashObject, ++aTry, aCallback); },
          TRY_DELAY);
      } else {
        this._logger.fatal("_testPlayer. Flash player testing failed.");
        FireFM.obsService.notifyObservers(
          null, FireFM.Player.TOPIC_PLAYER_ERROR,
          FireFM.Player.STATUS_PLUGIN_FAILED);
      }
    }
  },

  /**
   * Determines whether the extension identified by aExtensionId is intalled.
   * @param aExtensions the extensions object.
   * @return true if installed, false otherwise.
   */
  _isExtensionInstalled : function(aExtensions, aExtensionId) {
    this._logger.trace("_isExtensionInstalled");

    return (null != aExtensions.get(aExtensionId));
  },

  /**
   * Unblocks the Fire.fm player when it is blocked by certain extensions. A
   * style sheet that removes a special -moz-binding rule for flash embeds is
   * registered. This task has to be performed after every browser window loads.
   */
  _overrideFlashCSS : function() {
    this._logger.trace("_overrideFlashCSS");

    let sss =
      Cc["@mozilla.org/content/style-sheet-service;1"].
        getService(Ci.nsIStyleSheetService);
    let overrideSheetURL =
      FireFM.createURI("chrome://firefm/content/overrideFlashblock.css");

    sss.loadAndRegisterSheet(overrideSheetURL, sss.USER_SHEET);
    this._logger.info("CSS Flash blocking overridden");
  },

  /**
   * Sets the Fire.fm flash player as an allowed object using the NoScript
   * service.
   * @param aFlashURL The URL of the flash player.
   */
  _overrideNoscript : function(aFlashURL) {
    this._logger.trace("overrideNoscript");

    try {
      let noScriptService = FireFM.unwrap(Cc[NOSCRIPT_SERVICE].getService());

      if (null != noScriptService.allowObject) {
        noScriptService.allowObject(aFlashURL, "application/x-shockwave-flash");
      } else {
        noScriptService.setAllowedObject(
          aFlashURL, "application/x-shockwave-flash");
      }
    } catch (e) {
      this._logger.warn("Error overriding Noscript: " + e);
    }
  }
};

/**
 * FireFM.PlayerInitializer constructor.
 */
(function() {
  this.init();
}).apply(FireFM.PlayerInitializer);
