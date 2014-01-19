/**
 * Copyright (c) 2013, Jose Enrique Bolanos, Jorge Villalobos
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

/**
 * This object manages the state of all buttons and other elements that are
 * visible to the user. We have complex state transitions, such as station
 * loading, actual playback, login/logout, and online/offline.
 */
FireFMChrome.UIState = {
  /* Observer topics this object listens to. */
  _TOPICS : null,

  /* Logger for this object. */
  _logger : null,
  /* Online/offline application state. */
  _onLine : false,
  /* Indicates if a station is being searched for or not. */
  _stationSearching : false,
  /* Indicates if a station is loading or not. */
  _stationLoading : false,
  /* Indicates if the station is playing or not. */
  _stationPlaying : false,
  /* The currently logged in user. null if logged out. */
  _currentUser : null,
  /* Indicates whether the current track has been loved or not. */
  _loved : false,
  /* Volume preference. */
  _volumePref : null,
  /* Status bar visibility preference. */
  _statusbarPref : null,
  /* Status bar buttons preference. */
  _statusbarButtonsPref : null,
  /* The Now Playing broadcaster, which is frequently used. */
  _nowPlaying : null,
  /* The time left menu item, which is frequently used. */
  _timeLeftMenu : null,
  /* Preferences Branch for Fire.FM */
  _prefBranch : null,

  /**
   * Initializes the object.
   */
  init : function() {
    this._logger = FireFM.getLogger("FireFMChrome.UIState");
    this._logger.debug("init");

    this._setPreferencesCommand();
  },

  /**
   * Initializes most of the object after a delay.
   */
  postInit : function() {
    this._logger.debug("postInit");

    let prefService =
      Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);

    this._TOPICS =
      [ FireFM.Station.TOPIC_STATION_SET,
        FireFM.Station.TOPIC_STATION_SEARCHING,
        FireFM.Station.TOPIC_STATION_LOADING,
        FireFM.Station.TOPIC_STATION_OPENING,
        FireFM.Station.TOPIC_STATION_STOPPING,
        FireFM.Station.TOPIC_STATION_ERROR,
        FireFM.Player.TOPIC_TRACK_LOADED,
        FireFM.Player.TOPIC_PROGRESS_CHANGED,
        FireFM.Player.TOPIC_PLAYER_ERROR,
        FireFM.Login.TOPIC_USER_AUTHENTICATION,
        FireFM.Remote.TOPIC_TRACK_LOVED ];

    this._timeLeftMenu =
      document.getElementById("firefm-menu-playing-time-left");
    this._nowPlaying =
      document.getElementById("firefm-now-playing-broadcaster");

    // set all preference objects.
    this._volumePref =
      Application.prefs.get(FireFM.PREF_BRANCH + "volumeLevel");
    this._statusbarPref =
      Application.prefs.get(FireFM.PREF_BRANCH + "showInStatusBar");
    this._statusbarButtonsPref =
      Application.prefs.get(FireFM.PREF_BRANCH + "statusBarButtons");

    // add observers.
    for (let i = 0; i < this._TOPICS.length; i++) {
      FireFM.obsService.addObserver(this, this._TOPICS[i], false);
    }

    // get the preferences branch and add the observer.
    this._prefBranch = prefService.getBranch(FireFM.PREF_BRANCH);
    this._prefBranch.QueryInterface(Ci.nsIPrefBranch2);
    this._prefBranch.addObserver("", this, false);

    // gather state information.
    this._onLine = window.navigator.onLine;
    this._stationPlaying = FireFM.Player.isPlaying;
    this._stationLoading = FireFM.Station.isLoadingStation;
    this._currentUser = FireFM.Login.userName;
    this._setVolume(this._volumePref.value);
    this._toggleStatusBar(this._statusbarPref.value);
    this._customizeStatusBar(this._statusbarButtonsPref.value);
    this._setStationButtonFirstRun();
    // finally, refresh the state of the whole UI.
    this._setPlayerReady();
    this.refreshState();

    // set the now playing info for new windows.
    if (FireFM.Player.isPlaying) {
      this._setNowPlayingInfo(FireFM.Playlist.currentTrack);
    }
  },

  /**
   * Unloads the object.
   */
  uninit : function() {
    this._logger.debug("uninit");
    // remove observers.
    for (let i = 0; i < this._TOPICS.length; i++) {
      FireFM.obsService.removeObserver(this, this._TOPICS[i]);
    }

    this._prefBranch.removeObserver("", this);
  },

  /**
   * Sets up some features dependent on the player, like autoplay, the player
   * message and multi-touch gestures.
   */
  _setPlayerReady : function() {
    this._logger.trace("_setPlayerReady");

    if (!FireFM.autoplayDone) {
      FireFM.autoplayDone = true;

      try {
        let autoplay = Application.prefs.get(FireFM.PREF_BRANCH + "autoplay");
        let autoplayNotified =
          Application.prefs.get(FireFM.PREF_BRANCH + "autoplay.notified");

        if ("undefined" == typeof(FireFM.History)) {
          Components.utils.import("resource://firefm/fmHistory.js");
        }

        if (0 < FireFM.History.stationHistory.length) {
          let lastStation = FireFM.History.stationHistory[0];

          FireFM.Station.setStation(lastStation.id, lastStation.type);

          // show auto-play notification if it has never been shown
          if (autoplayNotified && !autoplayNotified.value) {
            this._showAutoplayNotification();

          // autoplay if set by the user
          } else if (autoplay && autoplay.value &&
                     (null != FireFM.Login.userName)) {
            FireFM.Station.play();
          }
        }

        // set up multi-touch gestures.
        FireFMChrome.BrowserOverlay.setupGestures();
      } catch (e) {
        this._logger.error("_setPlayerReady. Error setting up player:\n" + e);
      }
    }
  },

  /**
   * Shows the auto-play notification.
   */
  _showAutoplayNotification : function() {
    this._logger.trace("_showAutoplayNotification");

    let nb = gBrowser.getNotificationBox();
    let buttonYes = new Object();
    let buttonNo = new Object();
    let brand =
      document.getElementById("bundle_brand").getString("brandShortName");

    buttonYes.label =
      FireFM.overlayBundle.GetStringFromName("firefm.yes.label");
    buttonYes.accessKey =
      FireFM.overlayBundle.GetStringFromName("firefm.yes.accesskey");
    buttonYes.popup = null;
    buttonYes.callback = function() {
      Application.prefs.
        setValue(FireFM.PREF_BRANCH + "autoplay.notified", true);
      Application.prefs.setValue(FireFM.PREF_BRANCH + "autoplay", true);
      FireFM.Station.play();
    };

    buttonNo.label = FireFM.overlayBundle.GetStringFromName("firefm.no.label");
    buttonNo.accessKey =
      FireFM.overlayBundle.GetStringFromName("firefm.no.accesskey");
    buttonNo.popup = null;
    buttonNo.callback = function() {
      Application.prefs.
        setValue(FireFM.PREF_BRANCH + "autoplay.notified", true);
      Application.prefs.setValue(FireFM.PREF_BRANCH + "autoplay", false);
    };

    nb.appendNotification(
      FireFM.overlayBundle.formatStringFromName(
        "firefm.autoplayNotification.label", [ brand ], 1),
      "firefm-autoplay-notification", "chrome://firefm/skin/logo32.png",
      nb.PRIORITY_INFO_MEDIUM, [ buttonYes, buttonNo ]);
  },

  /**
   * Sets the label and accesskey for the preferences command. This needs
   * special attention because the label is platform-specific.
   */
  _setPreferencesCommand : function() {
    this._logger.trace("_setPreferencesCommand");

    let prefCmd = document.getElementById("firefm-preferences-cmd");
    let os = FireFM.getOperatingSystem();

    if ((FireFM.OS_WINDOWS == os) || (FireFM.OS_WINDOWS_VISTA == os)) {
      prefCmd.setAttribute(
        "label",
        FireFM.overlayBundle.GetStringFromName("firefm.options.label"));
      prefCmd.setAttribute(
        "accesskey",
        FireFM.overlayBundle.GetStringFromName("firefm.options.accesskey"));
    } else {
      prefCmd.setAttribute(
        "label",
        FireFM.overlayBundle.GetStringFromName("firefm.optionsUnix.label"));
      prefCmd.setAttribute(
        "accesskey",
        FireFM.overlayBundle.GetStringFromName("firefm.optionsUnix.accesskey"));
    }
  },

  /**
   * Refreshes the state of the UI components.
   */
  refreshState : function() {
    this._logger.debug("refreshState");
    this._refreshLoginBroadcaster();
    this._refreshLoginButton();
    this._refreshPlayButton();
    this._refreshSkipButton();
    this._refreshAmazonButton();
    this._refreshTagButton();
    this._refreshLoveButton();
    this._refreshBanButton();
    this._refreshRecentStationMenu();
    this._refreshNowPlayingMenu();
  },

  /**
   * Refreshes the state of the login broadcaster.
   */
  _refreshLoginBroadcaster : function() {
    this._logger.trace("_refreshLoginBroadcaster");

    let loginBroadcaster =
      document.getElementById("firefm-logged-in-broadcaster");

    if (this._onLine && (null != this._currentUser)) {
      loginBroadcaster.removeAttribute("disabled");
    } else {
      loginBroadcaster.setAttribute("disabled", true);
    }
  },

  /**
   * Refreshes the state of the login / logout button and the start station
   * function.
   */
  _refreshLoginButton : function() {
    this._logger.trace("_refreshLoginButton");

    let loginLogoutCmd = document.getElementById("firefm-login-logout-cmd");
    let stationCmd = document.getElementById("firefm-start-station-cmd");

    if (this._onLine) {
      loginLogoutCmd.removeAttribute("disabled");
      stationCmd.removeAttribute("disabled");
    } else {
      loginLogoutCmd.setAttribute("disabled", true);
      stationCmd.setAttribute("disabled", true);
    }
  },

  /**
   * Refreshes the state of the play / stop button.
   */
  _refreshPlayButton : function() {
    this._logger.trace("_refreshPlayButton");

    let playStopCmd = document.getElementById("firefm-play-stop-cmd");
    let playStopMenu = document.getElementById("firefm-play-stop-menu");

    playStopCmd.removeAttribute("disabled");

    if (this._onLine && (null != FireFM.Login.userName)) {
      let station = FireFM.Station.station;

      if (this._stationPlaying || this._stationSearching ||
          this._stationLoading) {
        playStopCmd.setAttribute("playing", true);
        playStopCmd.setAttribute(
          "label", FireFM.overlayBundle.GetStringFromName("firefm.stop.label"));

        if (this._stationPlaying) {
          playStopCmd.tooltipText =
            FireFM.overlayBundle.formatStringFromName(
              "firefm.stop.tooltip", [ station.title ], 1);
        } else {
          playStopCmd.tooltipText =
            FireFM.overlayBundle.GetStringFromName("firefm.stop.label");
        }

        if (null != playStopMenu) {
          playStopMenu.setAttribute(
            "accesskey",
            FireFM.overlayBundle.GetStringFromName("firefm.stop.accesskey"));
        }
      } else {
        playStopCmd.removeAttribute("playing");
        playStopCmd.setAttribute(
          "label",
          FireFM.overlayBundle.GetStringFromName("firefm.play.label"));

        if (null != station) {
          playStopCmd.tooltipText =
            FireFM.overlayBundle.formatStringFromName(
              "firefm.play.tooltip", [ station.title ], 1);
        } else {
          playStopCmd.tooltipText =
            FireFM.overlayBundle.GetStringFromName(
              "firefm.playDefault.tooltip");
          playStopCmd.setAttribute("disabled", true);
        }

        if (null != playStopMenu) {
          playStopMenu.setAttribute(
            "accesskey",
            FireFM.overlayBundle.GetStringFromName("firefm.play.accesskey"));
        }
      }
    } else {
      playStopCmd.removeAttribute("playing");
      playStopCmd.setAttribute(
        "label", FireFM.overlayBundle.GetStringFromName("firefm.play.label"));

      if (!this._onLine) {
        playStopCmd.tooltipText =
          FireFM.overlayBundle.GetStringFromName("firefm.offline.label");
      } else {
        playStopCmd.tooltipText =
          FireFM.overlayBundle.GetStringFromName("firefm.needLogin.label");
      }

      playStopCmd.setAttribute("disabled", true);

      if (null != playStopMenu) {
        playStopMenu.setAttribute(
          "accesskey",
          FireFM.overlayBundle.GetStringFromName("firefm.play.accesskey"));
      }
    }
  },

  /**
   * Refreshes the state of the skip button.
   */
  _refreshSkipButton : function() {
    this._logger.trace("_refreshSkipButton");

    let skipCmd = document.getElementById("firefm-skip-cmd");

    if (this._onLine) {
      if (this._stationPlaying) {
        skipCmd.removeAttribute("disabled");
        skipCmd.tooltipText =
          FireFM.overlayBundle.GetStringFromName("firefm.skip.tooltip");
      } else {
        skipCmd.setAttribute("disabled", true);
        skipCmd.tooltipText =
          FireFM.overlayBundle.GetStringFromName("firefm.skip.tooltip");
      }
    } else {
      skipCmd.setAttribute("disabled", true);
      skipCmd.tooltipText =
        FireFM.overlayBundle.GetStringFromName("firefm.skip.tooltip");
    }
  },

  /**
   * Refreshes the state of the Amazon button.
   */
  _refreshAmazonButton : function() {
    this._logger.trace("_refreshAmazonButton");

    let amazonCmd = document.getElementById("firefm-amazon-cmd");

    amazonCmd.setAttribute("disabled", true);

    if (this._onLine && (null != this._currentUser)) {
      amazonCmd.tooltipText =
        FireFM.overlayBundle.GetStringFromName("firefm.amazon.tooltip");

      if (this._stationPlaying) {
        amazonCmd.removeAttribute("disabled");
      }
    } else {
      amazonCmd.tooltipText =
        FireFM.overlayBundle.GetStringFromName("firefm.needLogin.label");
    }
  },

  /**
   * Refreshes the state of the tag track button.
   */
  _refreshTagButton : function() {
    this._logger.trace("_refreshTagButton");

    let tagCmd = document.getElementById("firefm-tag-cmd");

    tagCmd.setAttribute("disabled", true);

    if (this._onLine && (null != this._currentUser)) {
      tagCmd.tooltipText =
        FireFM.overlayBundle.GetStringFromName("firefm.tag.tooltip");

      if (this._stationPlaying) {
        tagCmd.removeAttribute("disabled");
      }
    } else {
      tagCmd.tooltipText =
        FireFM.overlayBundle.GetStringFromName("firefm.needLogin.label");
    }
  },

  /**
   * Refreshes the state of the love track button.
   */
  _refreshLoveButton : function() {
    this._logger.trace("_refreshLoveButton");
    // oh yeah, the love command :P
    let loveCmd = document.getElementById("firefm-love-cmd");

    loveCmd.setAttribute("disabled", true);

    if (this._onLine && (null != this._currentUser)) {
      if (this._stationPlaying) {
        if (!this._loved) {
          if (!this._lovedError) {
            loveCmd.tooltipText =
              FireFM.overlayBundle.GetStringFromName("firefm.love.tooltip");
          } else {
            loveCmd.tooltipText =
              FireFM.overlayBundle.GetStringFromName(
                "firefm.lovedError.tooltip");
          }

          loveCmd.removeAttribute("disabled");
        } else {
          loveCmd.tooltipText =
            FireFM.overlayBundle.GetStringFromName(
              "firefm.alreadyLoved.tooltip");
        }
      } else {
        loveCmd.tooltipText =
          FireFM.overlayBundle.GetStringFromName("firefm.love.tooltip");
      }
    } else {
      loveCmd.tooltipText =
        FireFM.overlayBundle.GetStringFromName("firefm.needLogin.label");
    }
  },

  /**
   * Refreshes the state of the ban track button.
   */
  _refreshBanButton : function() {
    this._logger.trace("_refreshBanButton");

    let banCmd = document.getElementById("firefm-ban-cmd");

    banCmd.setAttribute("disabled", true);

    if (this._onLine && (null != this._currentUser)) {
      banCmd.tooltipText =
        FireFM.overlayBundle.GetStringFromName("firefm.ban.tooltip");

      if (this._stationPlaying) {
        banCmd.removeAttribute("disabled");
      }
    } else {
      banCmd.tooltipText =
        FireFM.overlayBundle.GetStringFromName("firefm.needLogin.label");
    }
  },

  /**
   * Refreshes the state of the recent stations menu.
   */
  _refreshRecentStationMenu : function() {
    this._logger.trace("_refreshRecentStationMenu");

    let recentCmd = document.getElementById("firefm-recent-station-cmd");

    if (this._onLine && (null != this._currentUser)) {
      recentCmd.removeAttribute("disabled");
    } else {
      recentCmd.setAttribute("disabled", true);
    }
  },

  /**
   * Refreshes the state of the Now Playing menu.
   */
  _refreshNowPlayingMenu : function() {
    this._logger.trace("_refreshNowPlayingMenu");

    let nowPlaying = document.getElementById("firefm-menu-now-playing");

    if (null != nowPlaying) {
      if (this._onLine && this._stationPlaying) {
        nowPlaying.removeAttribute("disabled");
      } else {
        nowPlaying.setAttribute("disabled", true);
      }
    }
  },

  /**
   * Sets the Now Playing information with the given track.
   * @param aTrack the track to use to set the information.
   */
  _setNowPlayingInfo : function(aTrack) {
    this._logger.trace("_setNowPlayingInfo");

    let infoMenuItem = document.getElementById("firefm-menu-playing-info");
    let trackMenuItem = document.getElementById("firefm-menu-playing-track");
    let artistMenuItem = document.getElementById("firefm-menu-playing-artist");
    let albumMenuItem = document.getElementById("firefm-menu-playing-album");
    let freeMenuItem = document.getElementById("firefm-menu-playing-free");

    this._nowPlaying.setAttribute("tracktitle", aTrack.title);
    this._nowPlaying.setAttribute("trackimage", aTrack.imagePath);
    this._nowPlaying.setAttribute("trackurl", aTrack.trackURL);
    this._nowPlaying.setAttribute("freetrackurl", aTrack.freeTrackURL);
    this._nowPlaying.setAttribute("amazonurl", aTrack.amazonURL);
    this._nowPlaying.setAttribute("artist", aTrack.artist);
    this._nowPlaying.setAttribute("artisturl", aTrack.artistURL);
    this._nowPlaying.setAttribute("album", aTrack.albumTitle);
    this._nowPlaying.setAttribute("albumurl", aTrack.albumURL);
    this._nowPlaying.removeAttribute("message");
    this._nowPlaying.removeAttribute("progress");

    if (null != infoMenuItem) {
      let trackString = aTrack.title + " - " + aTrack.artist;

      infoMenuItem.setAttribute("label", trackString);
      infoMenuItem.setAttribute("tooltiptext", trackString);

      // XXX: don't use icon images on Mac because they're buggy and
      // causing crashes.
      if (FireFM.OS_MAC != FireFM.getOperatingSystem()) {
        infoMenuItem.setAttribute("image", aTrack.imagePath);
      } else {
        infoMenuItem.removeAttribute("class");
      }
    }

    if (null != trackMenuItem) {
      if (0 < String(aTrack.trackURL).length) {
        trackMenuItem.setAttribute("fmurl", aTrack.trackURL);
        trackMenuItem.removeAttribute("disabled");
      } else {
        trackMenuItem.setAttribute("disabled", true);
      }
    }

    if (null != artistMenuItem) {
      if (0 < String(aTrack.artistURL).length) {
        artistMenuItem.setAttribute("fmurl", aTrack.artistURL);
        artistMenuItem.removeAttribute("disabled");
      } else {
        artistMenuItem.setAttribute("disabled", true);
      }
    }

    if (null != albumMenuItem) {
      if (0 < String(aTrack.albumURL).length) {
        albumMenuItem.setAttribute("fmurl", aTrack.albumURL);
        albumMenuItem.removeAttribute("disabled");
      } else {
        albumMenuItem.setAttribute("disabled", true);
      }
    }

    if (null != freeMenuItem) {
      if (0 < String(aTrack.freeTrackURL).length) {
        freeMenuItem.setAttribute("fmurl", aTrack.freeTrackURL);
        freeMenuItem.removeAttribute("disabled");
      } else {
        freeMenuItem.setAttribute("disabled", true);
      }
    }
  },

  /**
   * Clearss the Now Playing information.
   */
  _clearNowPlayingInfo : function() {
    this._logger.trace("_clearNowPlayingInfo");
    this._nowPlaying.removeAttribute("trackimage");
    this._nowPlaying.removeAttribute("tracktitle");
    this._nowPlaying.removeAttribute("trackurl");
    this._nowPlaying.removeAttribute("artist");
    this._nowPlaying.removeAttribute("artisturl");
    this._nowPlaying.removeAttribute("album");
    this._nowPlaying.removeAttribute("albumurl");
  },

  /**
   * Sets the current online state.
   * @param aIsOnline whether the application is online or not. true if the
   * application is online, false otherwise.
   */
  _setOnlineState : function(aIsOnline) {
    this._logger.trace("_setOnlineState");
    this._onLine = aIsOnline;

    if (!aIsOnline && this._stationPlaying) {
      FireFM.Station.stop();
    }

    this.refreshState();
  },

  /**
   * Gets the volume Preference object.
   * @return the volume Preference object.
   */
  get volumePref() {
    // XXX: there is no logging here for performance reasons.
    return this._volumePref;
  },

  /**
   * Sets the volume in the volume scale.
   * @param aLevel the volume level in a scale from 0 to 100.
   */
  _setVolume : function(aLevel) {
    // XXX: there is no logging here for performance reasons.
    let volumeBroadcaster =
      document.getElementById("firefm-volume-broadcaster");
    let levelAttr = "high";

    if (aLevel == 0) {
      levelAttr = "zero";
    } else if (aLevel <= 50) {
      levelAttr = "low";
    }

    volumeBroadcaster.setAttribute("value", aLevel);
    volumeBroadcaster.setAttribute("volume", levelAttr);
  },

  /**
   * Shows or hides the statusbar Fire.fm toolbar.
   * @param aShouldShow true if the statusbar toolbar should be shown, false
   * otherwise.
   */
  _toggleStatusBar : function(aShouldShow) {
    this._logger.trace("_toggleStatusBar");

    let panel = document.getElementById("firefm-statusbar-panel");

    if (null != panel) {
      panel.hidden = !aShouldShow;
    }
  },

  /**
   * Customizes the Fire.fm statusbar with the current value of the buttons
   * preference.
   * @param aButtons string with the list of button ids as they should be shown.
   */
  _customizeStatusBar : function(aButtons) {
    this._logger.trace("_customizeStatusBar");

    let toolbar = document.getElementById("firefm-statusbar-toolbar");
    let toolbarButtons = toolbar.childNodes;
    let toolbarButton;
    let buttonRE;
    let buttonMatch;

    for (let i = 0; i < toolbarButtons.length; i++) {
      toolbarButton = toolbarButtons[i];

      if (!toolbarButton.id.match(/firefm/gi)) {
        //XXX: Elements that may have been added to Fire.fm's status bar toolbar
        //are ignored, eg. Foxytunes elements.
        continue;
      }

      buttonRE =
        new RegExp("(?:^|\\,)" + toolbarButton.id + "(\\[[a-z]+\\])?(?:\\,|$)");
      buttonMatch = buttonRE.exec(aButtons);

      if (null != buttonMatch) {
        toolbarButton.hidden = false;

        if ("firefm-status-track-info" == toolbarButton.id) {
          if ((1 < buttonMatch.length) && ("[large]" == buttonMatch[1])) {
            toolbarButton.firstChild.removeAttribute("small");
          } else {
            toolbarButton.firstChild.setAttribute("small", true);
          }
        }
      } else {
        toolbarButton.hidden = true;
      }
    }
  },

  /**
   * Sets a different appearance for the station button the first time the
   * extension runs.
   */
  _setStationButtonFirstRun : function() {
    this._logger.trace("_setStationButtonFirstRun");

    let firstRunPref =
      Application.prefs.get(FireFM.PREF_BRANCH + "stationFirstRun");

    if (firstRunPref.value && (0 == FireFM.Login.userList.length)) {
      let stationButton = document.getElementById("firefm-station-button");

      firstRunPref.value = false;
      stationButton.setAttribute("firstRun", true);
    }
  },

  /**
   * Sets the given message in the Now Playing observer.
   * @param aMessageKey the message key that holds the message. If null, the
   * message is cleared.
   * @param aParameter (optional) the parameter added to the message.
   */
  _setNowPlayingMessage : function(aMessageKey, aParameter) {
    this._logger.trace("_setNowPlayingMessage");

    if (null != aMessageKey) {
      if (aParameter) {
        this._nowPlaying.setAttribute(
          "message",
          FireFM.overlayBundle.formatStringFromName(
            aMessageKey, [ aParameter ], 1));
      } else {
        this._nowPlaying.setAttribute(
          "message", FireFM.overlayBundle.GetStringFromName(aMessageKey));
      }
    } else {
      this._nowPlaying.removeAttribute("message");
    }
  },

  /**
   * Displays a message or window to the user informing about the Player error
   * that occurred.
   * @param aPlayerStatus the player error status.
   */
  _handlePlayerError : function(aPlayerStatus) {
    this._logger.error("_handlePlayerError. Status: " + aPlayerStatus);

    let nb = gBrowser.getNotificationBox();

    this._setNowPlayingMessage("firefm.playerNotLoaded.label");

    switch (aPlayerStatus) {
      case FireFM.Player.STATUS_PLUGIN_MISSING:
        // show a notification in the browser area, telling the user that the
        // Flash plugin is not present or not up to date.
        let installButton = new Object();

        installButton.label =
          FireFM.overlayBundle.GetStringFromName(
            "firefm.pluginNotification.installPlugin.label");
        installButton.accessKey =
          FireFM.overlayBundle.GetStringFromName(
            "firefm.pluginNotification.installPlugin.accesskey");
        installButton.popup = null;
        installButton.callback =
          function() {
            openUILinkIn("http://www.adobe.com/go/getflashplayer", "tab"); };

        nb.appendNotification(
          FireFM.overlayBundle.GetStringFromName(
            "firefm.pluginNotification.label"),
          "firefm-plugin-notification", "chrome://firefm/skin/logo32.png",
          nb.PRIORITY_WARNING_HIGH, [ installButton ] );
        break;
      case FireFM.Player.STATUS_TRACK_LOAD_FAILED:
        // show a notification in the browser area, telling the user something
        // is preventing Fire.fm from loading tracks
        let learnMoreButton = new Object();

        learnMoreButton.label =
          FireFM.overlayBundle.GetStringFromName("firefm.learnMore.label");
        learnMoreButton.accessKey =
          FireFM.overlayBundle.GetStringFromName("firefm.learnMore.accesskey");
        learnMoreButton.popup = null;
        learnMoreButton.callback =
          function() {
            openUILinkIn(
              "http://firefm.sourceforge.net/help/#unabletocontact", "tab"); };

        nb.appendNotification(
          FireFM.overlayBundle.GetStringFromName(
            "firefm.connectionNotification.label"),
          "firefm-blocked-notification", "chrome://firefm/skin/logo32.png",
          nb.PRIORITY_WARNING_HIGH, [ learnMoreButton ]);

        this._setNowPlayingMessage("firefm.error.2.label");
        break;
      case FireFM.Player.STATUS_PLUGIN_FAILED:
        // not doing anything on purpose.
        break;
      default:
        // open an error reporting window that lets the user send us the error
        // that caused the player not to load.
        window.open(
          "chrome://firefm/content/fmErrorDialog.xul", "firefm-error-dialog",
          "chrome,dialog,centerscreen").focus();
        break;
    }
  },

  /**
   * Observes topic notifications.
   * @param aSubject The object that experienced the change.
   * @param aTopic The topic being observed.
   * @param aData The data relating to the change.
   */
  observe : function(aSubject, aTopic, aData) {
    // XXX: there is no logging here for performance purposes.
    switch (aTopic) {

      case FireFM.Station.TOPIC_STATION_SEARCHING:
        this._stationSearching = true;
        this.refreshState();
        this._setNowPlayingMessage(
          "firefm.searching.label", FireFM.decodeFMString(aData));
        break;

      case FireFM.Station.TOPIC_STATION_SET:
        this.refreshState();
        this._setNowPlayingMessage(
          "firefm.stoppedStation.label",
          decodeURIComponent(FireFM.unwrap(aSubject).title));
        break;

      case FireFM.Station.TOPIC_STATION_LOADING:
        this._stationLoading = true;
        this._stationSearching = false;
        this.refreshState();
        this._setNowPlayingMessage(
          "firefm.loadingStation.label",
          decodeURIComponent(FireFM.unwrap(aSubject).title));
        break;

      case FireFM.Station.TOPIC_STATION_OPENING:
        this._stationPlaying = true;
        this._stationLoading = false;
        this.refreshState();
        this._setNowPlayingMessage(
          "firefm.openingStation.label",
          decodeURIComponent(FireFM.unwrap(aSubject).title));
        break;

      case FireFM.Station.TOPIC_STATION_STOPPING:
        this._stationPlaying = false;
        this._stationLoading = false;
        this._stationSearching = false;
        this.refreshState();
        this._clearNowPlayingInfo();

        if (null != aSubject) {
          this._setNowPlayingMessage(
            "firefm.stoppedStation.label",
            decodeURIComponent(FireFM.unwrap(aSubject).title));
        }

        break;

      case FireFM.Station.TOPIC_STATION_ERROR:
        this._setNowPlayingMessage("firefm.error." + aData + ".label");

        this._stationLoading = false;
        this._stationSearching = false;
        this.refreshState();

        if (this._stationPlaying &&
            (FireFM.Station.ERROR_NOT_FOUND == parseInt(aData))) {
          let that = this;
          // clear the message, so that the current station can continue
          // showing its information.
          FireFM.runWithDelay(
            function() { that._setNowPlayingMessage(null); }, 5000);
        }
        break;

      case FireFM.Player.TOPIC_TRACK_LOADED:
        this._loved = false;
        this._lovedError = false;
        this.refreshState();
        this._setNowPlayingInfo(FireFM.unwrap(aSubject));
        break;

      case FireFM.Player.TOPIC_PROGRESS_CHANGED:
        let remaining = FireFM.Player.remainingTime;

        this._nowPlaying.setAttribute("progress", aData);
        this._nowPlaying.setAttribute("remainingtime", "-" + remaining);
        this._nowPlaying.setAttribute("isbuffering", FireFM.Player.isBuffering);

        if (null != this._timeLeftMenu) {
          this._timeLeftMenu.setAttribute(
            "label",
            FireFM.overlayBundle.formatStringFromName(
              "firefm.timeLeft.label", [ remaining ], 1));
        }
        break;

      case FireFM.Login.TOPIC_USER_AUTHENTICATION:
        if (null != aData) {
          this._logger.debug("observe. Logged in as: " + aData);
          this._currentUser = aData;
          this.refreshState();
        } else {
          this._logger.debug("observe. Logged out.");
          this._currentUser = null;
          this.refreshState();
        }

        break;

      case FireFM.Remote.TOPIC_TRACK_LOVED:
        if (null == aData) {
          this._loved = true;
          this.refreshState();
        } else if ("false" == aData) {
          this._lovedError = true;
          this._loved = false;
          this.refreshState();
        }
        break;

      case FireFM.Player.TOPIC_PLAYER_ERROR:
        FireFM.Station.stop();
        this._handlePlayerError(parseInt(aData));
        break;

      case "nsPref:changed":
        switch (aData) {
          case "volumeLevel":
            this._setVolume(this._volumePref.value);
            break;
          case "showInStatusBar":
            this._toggleStatusBar(this._statusbarPref.value);
            break;
          case "statusBarButtons":
            this._customizeStatusBar(this._statusbarButtonsPref.value);
            break;
          case "recent.history":
            let stationButton =
              document.getElementById("firefm-station-button");

            stationButton.removeAttribute("firstRun");
            break;
        }
        break;
    }
  }
};

window.addEventListener(
  "online", function() { FireFMChrome.UIState._setOnlineState(true); }, false);
window.addEventListener(
  "offline", function() { FireFMChrome.UIState._setOnlineState(false); },
  false);
