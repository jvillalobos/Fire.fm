/**
 * Copyright (c) 2008-2010, Jose Enrique Bolanos, Jorge Villalobos
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

var EXPORTED_SYMBOLS = [ "FireFM.Notifier" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Ce = Components.Exception;

Components.utils.import("resource://firefm/fmCommon.js");
Components.utils.import("resource://firefm/fmPlayer.js");

// Notification mode values
const NOTIFICATIONS_MODE_OFF   = 0;
const NOTIFICATIONS_MODE_ON    = 1;
const NOTIFICATIONS_MODE_FOCUS = 2;

/**
 * FireFM Notifier. Displays notifications on station and player events.
 */
if (typeof(FireFM.Notifier) == 'undefined') {
FireFM.Notifier = {

  /* Logger for this object. */
  _logger : null,
  /* Alerts service */
  _alertsService : null,
  /* Window manager */
  _windowManager : null,
  /* Notification mode preference object. */
  _notificationModePref : null,
  /* Notification title */
  _title : null,

  /**
   * Initializes the object.
   */
  init : function() {
    this._logger = FireFM.getLogger("FireFM.Notifier");
    this._logger.debug("init");

    // XXX: Try-catch block because the alertsService is not available on all
    // operating systems.
    try {

      this._alertsService =
        Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
      this._windowManager =
        Cc['@mozilla.org/appshell/window-mediator;1'].
          getService(Ci.nsIWindowMediator);
      this._title =
        FireFM.overlayBundle.GetStringFromName(
          "firefm.notification.nowPlaying");

      this._notificationModePref =
        FireFM.Application.prefs.get(FireFM.PREF_BRANCH + "notifications.mode");

      FireFM.obsService.addObserver(
        this, FireFM.Player.TOPIC_TRACK_LOADED, false);
    } catch (e) {
      this._alertsService = null;
    }
  },

  /**
   * Displays a notification using the alerts service for the given track.
   * @param aTrack The track that has been loaded.
   */
  _notifyTrackLoaded : function(aTrack) {
    this._logger.trace("_notifyTrackLoaded");

    var mode = this._notificationModePref.value;
    var win = this._windowManager.getMostRecentWindow("navigator:browser");

    if (NOTIFICATIONS_MODE_ON == mode ||
        (NOTIFICATIONS_MODE_FOCUS == mode &&
         (!win || !win.document.hasFocus()))) {

      var image = (this._isValidImage(aTrack.imagePath)) ?
                  aTrack.imagePath : "chrome://firefm/skin/logo32.png";
      var trackInfo = aTrack.title + "\n" + aTrack.artist;

      if (0 < aTrack.albumTitle.length) {
        trackInfo += "\n" + aTrack.albumTitle;
      }

      this._alertsService.showAlertNotification(
        image, this._title, trackInfo, true, aTrack.artistURL, this);
    }
  },

  /**
   * Determines whether an image URL is valid (valid URL, file exists).
   * @param aImageURL The URL of the image.
   * @return True if valid, false if not valid.
   */
  _isValidImage : function(aImageURL) {
    this._logger.trace("_isValidImage");

    let isValid = false;

    try {
      if (null != FireFM.createURI(aImageURL)) {
        let request =
          Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].
            createInstance(Ci.nsIXMLHttpRequest);

        request.open("GET", aImageURL, false);
        request.send(null);

        isValid = (200 == request.status);
      }
    } catch (e) {
    }

    return isValid;
  },

  /**
   * Loads the given URL in the most recent window. If there are no windows
   * currently opened, the URL is loaded in a new window.
   * @param aURL The URL to be loaded.
   */
  _loadURL : function(aURL) {
    this._logger.trace("_loadURL");

    var win = this._windowManager.getMostRecentWindow("navigator:browser");

    if (win) {
      win.openUILinkIn(aURL, 'tab');
    } else {
      win =
        Cc["@mozilla.org/appshell/appShellService;1"].
          getService(Ci.nsIAppShellService).hiddenDOMWindow.open(aURL);
    }
    // TODO: Force focus somehow, but seems impossible
    win.focus();
  },

  /**
   * Observes topic notifications.
   * @param aSubject The object that experienced the change.
   * @param aTopic The topic being observed.
   * @param aData The data relating to the change.
   */
  observe : function(aSubject, aTopic, aData) {
    this._logger.debug("observe");

    switch (aTopic) {
      case FireFM.Player.TOPIC_TRACK_LOADED:
        if (null != this._alertsService) {
          let track = FireFM.unwrap(aSubject);

          this._notifyTrackLoaded(track);
        }

        break;

      case "alertclickcallback":
        this._loadURL(aData);
        break;
    }
  }

};}

/**
 * FireFM.Notifier constructor.
 */
(function() {
  FireFM.Notifier.init();
}).apply(FireFM.Notifier);
