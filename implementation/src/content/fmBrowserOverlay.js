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

Components.utils.import("resource://firefm/fmCommon.js");

/**
 * FireFM chrome namespace. We need a separate one because this one is defined
 * per window.
 */
if (typeof(FireFMChrome) == 'undefined') {
  var FireFMChrome = {};
};

/* XXX: SeaMonkey compatibility. */
if (typeof(Cc) == 'undefined') {
  var Cc = Components.classes;
  var Ci = Components.interfaces;
};

/**
 * Browser overlay controller. This is the entry point for most operations that
 * happen in the toolbar.
 */
FireFMChrome.BrowserOverlay = {
  /* Logger for this object. */
  _logger : null,
  /* Reference to the preferences window. */
  _preferencesWindow : null,
  /* The gestures preference object. */
  _gesturesPref : null,
  /* The amount of time within which the ban gesture should be performed. */
  _banGestureTime : 0,
  /* The state of a ban gesture currently in progress. */
  _banGestureState : -1,
  /* Ban timeout identifier. */
  _banTimeout : -1,
  /* Event listener for the opening of the context menu. */
  _contextMenuListener : null,

  /**
   * Initializes the object.
   */
  init : function() {
    const POST_INIT_TIMEOUT = 500;
    let that = this;

    this._logger = FireFM.getLogger("FireFMChrome.BrowserOverlay");
    this._logger.debug("init");

    this._contextMenuListener =
      function(aEvent) { that._prepareContextMenu(aEvent); };

    // Add listeners
    document.getElementById("contentAreaContextMenu").addEventListener(
      "popupshowing", this._contextMenuListener, false);

    try {
      // startup steps we need to run only once.
      if (!FireFM.startupDone) {
        FireFM.startupDone = true;

        FireFM.runWithDelay(
          function() {
            try {
              // load all modules that we need on post-init.
              Components.utils.import("resource://firefm/fmPlayer.js");
              Components.utils.import("resource://firefm/fmStation.js");
              Components.utils.import("resource://firefm/fmLogin.js");

              // XXX: we log in first to make sure we can autoplay once the
              // player is ready.
              FireFM.Login.init();
              FireFMChrome.UIState.postInit();
              FireFMChrome.Feeds.init();
            } catch (e) {
              that._logger.error("init. Post init error.\n" + e);
            }
          },
          POST_INIT_TIMEOUT);
      } else {
        FireFM.runWithDelay(
          function() {
            try {
              FireFMChrome.UIState.postInit();
              FireFMChrome.Feeds.init();
            } catch (e) {
              that._logger.error("init. Post init error.\n" + e);
            }
          }, POST_INIT_TIMEOUT);
      }
    } catch (e) {
      this._logger.error("init. init error.\n" + e);
    }

    FireFMChrome.UIState.init();
  },

  /**
   * Unloads the object.
   */
  uninit : function() {
    this._logger.debug("uninit");

    FireFMChrome.UIState.uninit();
    FireFMChrome.Feeds.uninit();

    // Remove listeners
    document.getElementById("contentAreaContextMenu").removeEventListener(
      "popupshowing", this._contextMenuListener, false);
  },

  /**
   * Prepares the Fire.fm menu items located in the content area context menu
   * before it is displayed.
   * @param aEvent The event object associated with this event.
   */
  _prepareContextMenu : function(aEvent) {
    this._logger.trace("_prepareContextMenu");

    const FIREFM_SELECTION_TEXT_MAX_LENGTH = 20;
    let menuStartStation =
      document.getElementById("firefm-context-menu-start-station");
    let menuArtists = document.getElementById("firefm-context-menu-artists");

    if (null != FireFM.Login.userName) {

      let selection =
        document.commandDispatcher.focusedWindow.getSelection().toString();

      if (0 < selection.length) {
        menuStartStation.setAttribute("selection", selection);

        // Crop selection
        if (FIREFM_SELECTION_TEXT_MAX_LENGTH < selection.length) {
          selection =
            selection.substring(0, FIREFM_SELECTION_TEXT_MAX_LENGTH) + "...";
        }

        menuStartStation.setAttribute("label",
          FireFM.overlayBundle.formatStringFromName(
            "firefm.context.play.label", [ selection ], 1));
        menuStartStation.hidden = false;
      } else {
        menuStartStation.hidden = true;
      }

      this.loadAudioMicroformats(menuArtists.firstChild);
    } else {
      menuStartStation.hidden = true;
      menuArtists.hidden = true;
    }
  },

  /**
   * Opens the Last.fm home page.
   * @param aEvent the event that triggered this action.
   */
  openHome : function(aEvent) {
    this._logger.debug("openHome");
    window.openUILink(FireFM.Remote.URL_HOME, aEvent);
  },

  /**
   * Logs the user in or out, depending the user's current state.
   * @param aEvent the event that triggered this action.
   */
  loginLogout : function(aEvent) {
    this._logger.debug("loginLogout");

    let menuItem = aEvent.originalTarget;

    if (menuItem.hasAttribute("loggedin")) {
      FireFM.Login.logout();
    } else {
      FireFM.Login.login(menuItem.getAttribute("label"));
    }
  },

  /**
   * Loads the user list in a login popup.
   * @param aEvent the event that triggered this action.
   */
  loadUserList : function(aEvent) {
    this._logger.debug("loadUserList");

    let userList = FireFM.Login.userList;
    let userCount = userList.length;
    let popup = aEvent.target;
    let menuItem;
    let separator;

    // clear the list.
    while ("menuitem" == popup.firstChild.tagName) {
      popup.removeChild(popup.firstChild);
    }

    separator = popup.firstChild;

    if (0 < userCount) {
      for (let i = 0; i < userCount; i++) {
        menuItem = document.createElement("menuitem");
        menuItem.setAttribute("label", userList[i]);
        menuItem.setAttribute("type", "checkbox");

        if (FireFM.Login.userName == userList[i]) {
          menuItem.setAttribute("checked", "true");
          menuItem.setAttribute("loggedin", "true");
        }

        popup.insertBefore(menuItem, separator);
      }
    } else {
      // add an empty element.
      menuItem = document.createElement("menuitem");
      menuItem.setAttribute(
        "label",
        FireFM.overlayBundle.GetStringFromName("firefm.emptyMenu.label"));
      menuItem.setAttribute("disabled", true);
      popup.insertBefore(menuItem, separator);
    }
  },

  /**
   * Displays a dialog that asks the user to enter an artist, tag or user name
   * to start a station. The input is then verified against Last.fm.
   * @param aEvent the event that triggered this action.
   */
  startStation : function(aEvent) {
    this._logger.debug("startStation");

    if (window.navigator.onLine) {
      let station = { type : -1, value : "" };

      // if there are no users, ask for registration first.
      if (0 == FireFM.Login.userList.length) {
        let result = { success : false };

        window.openDialog(
          "chrome://firefm/content/fmAccountDialog.xul",
          "firefm-account-dialog",
          "chrome,titlebar,toolbar,centerscreen,dialog,modal,resizable=no",
          result);

        if (result.success) {
          // log in automatically.
          FireFM.Login.login(result.username);
          // open station dialog.
          this._openStartStationDialog();
        }
      } else if (!FireFM.Login.userName) {
        if (1 == FireFM.Login.userList.length) {
          // log in automatically if there's only one user.
          FireFM.Login.login(FireFM.Login.userList[0]);
          // open station dialog.
          this._openStartStationDialog();
        } else {
          // prompt the user to log in.
          let promptService =
            Cc["@mozilla.org/embedcomp/prompt-service;1"].
              getService(Ci.nsIPromptService);

          promptService.alert(
            window,
            FireFM.overlayBundle.GetStringFromName(
              "firefm.loginRequired.title"),
            FireFM.overlayBundle.GetStringFromName("firefm.needLogin.label"));
        }
      } else {
        this._openStartStationDialog();
      }
    } else {
      let promptService =
        Cc["@mozilla.org/embedcomp/prompt-service;1"].
          getService(Ci.nsIPromptService);

      promptService.alert(
        window,
        FireFM.overlayBundle.GetStringFromName("firefm.startAStation.label"),
        FireFM.overlayBundle.GetStringFromName("firefm.offline.label"));
    }
  },

  /**
   * Opens the start station dialog.
   */
  _openStartStationDialog : function() {
    this._logger.trace("_openStartStationDialog");

    let station = { type : -1, value : "" };

    window.openDialog(
      "chrome://firefm/content/fmStartStationDialog.xul",
      "firefm-start-station-dialog",
      "chrome,modal,centerscreen,titlebar,toolbar,resizable=no", station);

    if ((-1 != station.type) && (0 < station.value.length)) {
      this.verifyStation(station.value, station.type);
    }
  },

  /**
   * Verifies the station information entered by the user against Last.fm, and
   * loads the station if it's correct. Otherwise it opens a search page with
   * the given search string.
   * @param aId the ID of the station.
   * @param aType the type of the station.
   */
  verifyStation : function(aId, aType) {
    this._logger.debug("verifyStation");

    let that = this;
    let id = unescape(aId);

    FireFM.Station.verifyStation(
      id, aType, function(aResult) { that._verifyStationLoad(aResult, aType) });
  },

  /**
   * Load handler for the verify station request.
   * @param aResult the resulting object from the request. See
   * FireFM.Station.verifyStation for more information.
   * @param aType the type of station to load.
   */
  _verifyStationLoad : function(aResult, aType) {
    this._logger.debug("_verifyStationLoad");

    if (aResult.success) {
      FireFM.Station.setStation(aResult.result, aType);
      FireFM.Station.play();
      this._logger.debug("_verifyStationLoad. Player loaded");
    } else {
      window.openUILinkIn(aResult.result, "tab");
      FireFM.obsService.notifyObservers(
        null, FireFM.Station.TOPIC_STATION_ERROR,
        FireFM.Station.ERROR_NOT_FOUND);
    }
  },

  /**
   * Starts a station with the recommendations from Last.fm for the logged in
   * user.
   * @param aEvent the event that triggered this action.
   */
  startRecommendations : function(aEvent) {
    this._logger.debug("startRecommendations");
    FireFM.Station.setStation(
      FireFM.Login.userName, FireFM.Station.TYPE_RECOMMENDED);
    FireFM.Station.play();
  },

  /**
   * Starts a station with the current user's library.
   * @param aEvent the event that triggered this action.
   */
  startMyLibrary : function(aEvent) {
    this._logger.debug("startMyLibrary");

    FireFM.Station.setStation(FireFM.Login.userName, FireFM.Station.TYPE_USER);
    FireFM.Station.play();
  },

  /**
   * Starts a station based on the user's 'neighbors'.
   * @param aEvent the event that triggered this action.
   */
  startNeighborhood : function(aEvent) {
    this._logger.debug("startNeighborhood");

    FireFM.Station.setStation(
      FireFM.Login.userName, FireFM.Station.TYPE_NEIGHBORHOOD);
    FireFM.Station.play();
  },

  /**
   * Starts the station for a friend or neighbor.
   * @param aEvent the event that triggered this action.
   */
  startUserStation : function(aEvent) {
    this._logger.debug("startUserStation");

    let userName = aEvent.originalTarget.getAttribute("label");

    FireFM.Station.setStation(userName, FireFM.Station.TYPE_USER);
    FireFM.Station.play();
  },

  /**
   * Starts the station for a top artist.
   * @param aEvent the event that triggered this action.
   */
  startArtistStation : function(aEvent) {
    this._logger.debug("startArtistStation");

    let artist = aEvent.originalTarget.getAttribute("label");

    this.verifyStation(artist, FireFM.Station.TYPE_ARTIST);
  },

  /**
   * Starts a recently played station.
   * @param aEvent the event that triggered this action.
   */
  startRecentStation : function(aEvent) {
    this._logger.debug("startRecentStation");

    let menuItem = aEvent.originalTarget;
    let stationId = menuItem.getAttribute("fmstationid");
    let stationType = parseInt(menuItem.getAttribute("fmstationtype"), 10);

    FireFM.Station.setStation(stationId, stationType);
    FireFM.Station.play();
  },

  /**
   * Plays or stops playback on a station.
   * @param aEvent the event that triggered this action.
   */
  playStop : function(aEvent) {
    this._logger.debug("playStop");

    if (aEvent.target.hasAttribute("playing")) {
      FireFM.Station.stop();
    } else {
      FireFM.Station.play();
    }
  },

  /**
   * Skips to the next track in the playlist.
   * @param aEvent the event that triggered this action.
   */
  skip : function(aEvent) {
    this._logger.debug("skip");
    FireFM.Station.skip();
  },

  /**
   * Handles the oncommand event of the volume control toolbar and status bar
   * button. Depending on the volume mode preference, it shows the volume slider
   * or toggles the volume mute.
   * @param aEvent The event that triggered this action.
   */
  onVolumeCommand : function(aEvent) {
    this._logger.debug("onVolumeCommand");

    const FIREFM_PREFERENCE_VOLUME_MODE_ADVANCED = 1;

    let volumeModePref =
      FireFM.Application.prefs.get(FireFM.PREF_BRANCH + "volume.mode");

    if (volumeModePref.value == FIREFM_PREFERENCE_VOLUME_MODE_ADVANCED) {
      this.toggleMute();
    } else {
      aEvent.target.firstChild.openPopup(aEvent.target, 'after_start');
    }
  },

  /**
   * Sets the volume of the player.
   * @param aLevel The volume level to set.
   * @param aPersist True if the volume preference must be set. False otherwise.
   */
  setVolume : function(aLevel, aPersist) {
    // XXX: there is no logging here for performance reasons.
    try {
      FireFM.Player.setVolume(aLevel);
    } catch(e) {
      this._logger.error("setVolume. Error:\n" + e);
    }

    if (aPersist) {
      FireFMChrome.UIState.volumePref.value = aLevel;
    }
  },

  /**
   * Toggles the volume level between the minimum and maximum levels.
   */
  toggleMute : function() {
    this._logger.debug("toggleVolume");

    try {
      if (FireFM.Player.volume == 0) {
        this.setVolume(100, true);
      } else {
        this.setVolume(0, true);
      }
    } catch (e) {
      this._logger.error("toggleVolume. Error:\n" + e);
    }
  },

  /**
   * Checks the appropriate volume menu item depending on the current volume
   * level.
   */
  checkVolumeItem : function(aEvent) {
    this._logger.debug("checkVolumeItem");

    let level = FireFMChrome.UIState.volumePref.value;
    // calculate which child should be checked.
    let index = 10 - (Math.round(level / 10));

    aEvent.target.childNodes[index].setAttribute("checked", true);
  },

  /**
   * Opens the Amazon search result page for the current track.
   * @param aEvent The event that triggered this action.
   */
  buyOnAmazon : function(aEvent) {
    this._logger.debug("buyOnAmazon");
    window.openUILink(FireFM.Playlist.currentTrack.amazonURL, aEvent);
  },

  /**
   * Opens the tag track dialog.
   * @param aEvent The event that triggered this action.
   */
  tagTrack : function(aEvent) {
    this._logger.debug("tagTrack");

    let currentTrack = FireFM.Playlist.currentTrack;
    if (null != currentTrack) {

      let tags = { newTags : [], removedTags : [], track : null, type : -1 };
      tags.track = currentTrack;

      window.openDialog(
        "chrome://firefm/content/fmTagDialog.xul",
        "firefm-tag-dialog",
        "chrome,modal,centerscreen,titlebar,toolbar,resizable=no", tags);

      if (-1 != tags.type) {
        if (0 < tags.newTags.length) {
          FireFM.Remote.addTags(tags.track, tags.type, tags.newTags);
        }
        for (let i = 0; i < tags.removedTags.length; i++) {
          FireFM.Remote.removeTag(tags.track, tags.type, tags.removedTags[i]);
        }
      }
    }
  },

  /**
   * Marks the currently played track as 'loved'.
   * @param aEvent The event that triggered this action.
   */
  loveTrack : function(aEvent) {
    this._logger.debug("loveTrack");

    if (null != FireFM.Playlist.currentTrack) {
      // this is done to immediately disable the button and prevent multiple
      // submissions.
      FireFM.obsService.notifyObservers(
        null, FireFM.Remote.TOPIC_TRACK_LOVED, null);
      FireFM.Remote.loveTrack();
    }
  },

  /**
   * Marks the currently played track as 'banned' and skips to the next one.
   * @param aEvent The event that triggered this action.
   */
  banTrack : function(aEvent) {
    this._logger.debug("banTrack");

    if (null != FireFM.Playlist.currentTrack) {
      FireFM.Remote.banTrack();
      this.skip(aEvent);
    }
  },

  /**
   * Fills the recent station menu popup with the most recently played stations.
   * @param aEvent the event that triggered this action.
   */
  fillRecentStations : function(aEvent) {
    this._logger.debug("fillRecentStations");

    let popup = aEvent.target;
    let recent = FireFM.History.stationHistory;
    let recentCount = recent.length;
    let menuItem;
    let station;

    // clear the popup.
    while (null != popup.firstChild) {
      popup.removeChild(popup.firstChild);
    }

    if (0 < recentCount) {
      for (let i = 0; i < recentCount; i++) {
        station = recent[i];
        menuItem = document.createElement("menuitem");
        menuItem.setAttribute("label",  station.title);
        menuItem.setAttribute("fmstationid",  station.id);
        menuItem.setAttribute("fmstationtype", station.type);
        popup.appendChild(menuItem);
      }
    } else {
      menuItem = document.createElement("menuitem");
      menuItem.setAttribute(
        "label",
        FireFM.overlayBundle.GetStringFromName("firefm.emptyMenu.label"));
      menuItem.setAttribute("disabled", true);
      popup.appendChild(menuItem);
    }
  },

  /**
   * Opens a page related to the currently playing track.
   * @param aEvent the event that triggered this action.
   */
  openTrackPage : function(aEvent) {
    this._logger.debug("openTrackPage");
    window.openUILink(aEvent.target.getAttribute("fmurl"), aEvent);
  },

  /**
   * Opens the preferences window.
   * @param aPaneId (optional) the id of the pane to open on the window.
   */
  openPreferences : function(aPaneId) {
    this._logger.debug("openPreferences");

    if (null == this._preferencesWindow || this._preferencesWindow.closed) {
      let instantApply =
        FireFM.Application.prefs.get("browser.preferences.instantApply");
      let features =
        "chrome,titlebar,toolbar,centerscreen" +
        (instantApply.value ? ",dialog=no" : ",modal");

      this._preferencesWindow =
        window.openDialog(
          "chrome://firefm/content/fmPreferencesWindow.xul",
          "firefm-preferences-window", features, aPaneId);
    }

    this._preferencesWindow.focus();
  },

  /**
   * Loads the hAudio microformats found in the current document into the given
   * menu popup.
   * @param aMenuPopup The menu popup to be loaded with the hAudio microformats.
   */
  loadAudioMicroformats : function(aMenuPopup) {
    this._logger.debug("loadAudioMicroformats");

    if ("undefined" == typeof(hAudio)) {
      Components.utils.import("resource://firefm/hAudio.js");
    }

    let audios = FireFM.Microformats.getAudioMicroformats(content.document);

    while (aMenuPopup.firstChild) {
      aMenuPopup.removeChild(aMenuPopup.firstChild);
    }

    aMenuPopup.parentNode.hidden = true;

    if (0 < audios.length) {
      let artists = new Array();
      let startCommand =
        "FireFMChrome.BrowserOverlay.verifyStation(" +
        "this.getAttribute('label'), FireFM.Station.TYPE_ARTIST)";
      let artist = null;
      let item;

      for (var i = 0; i < audios.length; i++) {
        if (typeof(audios[i].contributor) != 'undefined') {
          artists.push(audios[i].contributor);
        }
      }

      artists.sort();

      for (var i = 0; i < artists.length; i++) {
        if (artists[i] != artist) {
          artist = artists[i];

          item = document.createElement("menuitem");
          item.setAttribute("label", artist);
          item.setAttribute("oncommand", startCommand);
          aMenuPopup.appendChild(item);
          aMenuPopup.parentNode.hidden = false;
        }
      }
    }
  },

  /**
   * Sets up advanced mouse gestures by replacing a function in browser.js.
   * XXX: the code in browser.js makes it very difficult for extensions to
   * resgister listeners to the gesture events, so we need to do this hack to
   * support them. See:
   * http://mxr.mozilla.org/mozilla1.9.1/source/browser/base/content/
   * browser.js#713
   * @param aEvent the event that triggered this action.
   */
  setupGestures : function() {
    this._logger.debug("setupGestures");

    if (("undefined" != typeof(gGestureSupport)) && gGestureSupport.onSwipe) {
      this._logger.debug("setupGestures. Gestures supported.");

      let that = this;
      let oldOnSwipe = gGestureSupport.onSwipe;

      this._gesturesPref =
        Application.prefs.get(FireFM.PREF_BRANCH + "useGestures");
      this._banGestureTime =
        Application.prefs.get(FireFM.PREF_BRANCH + "banGestureTime").value;

      gGestureSupport.onSwipe = function(aEvent) {
        if (that._gesturesPref.value) {
          switch (aEvent.direction) {
            case aEvent.DIRECTION_UP:
              let more = (FireFMChrome.UIState.volumePref.value + 25);

              FireFMChrome.BrowserOverlay.setVolume(
                ((100 >= more) ? more : 100), true);
              break;
            case aEvent.DIRECTION_DOWN:
              let less = (FireFMChrome.UIState.volumePref.value - 25);

              FireFMChrome.BrowserOverlay.setVolume(
                ((0 <= less) ? less : 0), true);
              break;
            case aEvent.DIRECTION_RIGHT:
              if (1 == that._banGestureState) {
                // swipe right during ban operation.
                that._banGestureState = 2;
              } else if (FireFM.Player.isPlaying) {
                FireFM.Station.skip();
              }
              break;
            case aEvent.DIRECTION_LEFT:
              if (2 == that._banGestureState) {
                // second left swipe, perform the ban operation.
                that.banTrack(aEvent);
                that._banTimeout.cancel();
                that._banGestureState = -1;
                that._banTimeout = -1;
              } else {
                // first left swipe. Set state and timer.
                that._banGestureState = 1;

                if (that._banTimeout) {
                  that._banTimeout.cancel();
                }
                // the timeout clears the state if the gesture takes too long,
                // given that it's likely the user wasn't meaning to make such a
                // slow gesture.
                that._banTimeout =
                  FireFM.runWithDelay(
                    function() {
                      that._banGestureState = -1;
                      that._banTimeout = -1;
                    },
                    that._banGestureTime);
              }
              break;
          }
        } else {
          oldOnSwipe.call(gGestureSupport, aEvent);
        }
      }
    }
  }
};

window.addEventListener(
  "load", function() { FireFMChrome.BrowserOverlay.init(); }, false);
window.addEventListener(
  "unload", function() { FireFMChrome.BrowserOverlay.uninit(); }, false);
