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

var EXPORTED_SYMBOLS = [ "FireFM.Player" ];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Ce = Components.Exception;

Components.utils.import("resource://firefm/fmCommon.js");
Components.utils.import("resource://firefm/fmPlaylist.js");

// Timeout delay in ms for the progress check timer
const PROGRESS_TIMEOUT = 100;
// Number of progress ticks before declaring "buffering state"
const BUFFERING_TICKS_LIMIT = 20; // 2 seconds if progress timeout is 100ms
// Maximum number of consecutive load failures to accept
const MAX_LOAD_FAILURES = 3;

/**
 * FireFM Player. Controls playback of music tracks.
 */
if (typeof(FireFM.Player) == 'undefined') {
FireFM.Player = {

  // Topic notifications sent from this object
  get TOPIC_TRACK_LOADED()     { return "firefm-track-loaded";     },
  get TOPIC_PLAYER_STOPPED()   { return "firefm-player-stopped";   },
  get TOPIC_PROGRESS_CHANGED() { return "firefm-progress-changed"; },
  get TOPIC_PLAYER_ERROR()     { return "firefm-player-error";     },

  // Constants for the possible errors.
  get STATUS_PLUGIN_MISSING() { return 1; },
  get STATUS_PLUGIN_FAILED() { return 4; },
  get STATUS_LOAD_ERROR()     { return 2; },
  get STATUS_TRACK_LOAD_FAILED()   { return 3; },

  /* Logger for this object. */
  _logger : null,
  /* Reference to the embedded player object. */
  _playerObj : null,
  /* Timer used to check track playback progression. */
  _timer : null,
  /* Holds the info of the track being played. */
  _track : null,
  /* Holds the value of the isPlaying property. */
  _isPlayingValue : false,
  /* Holds the value of the isBuffering property. */
  _isBufferingValue : false,
  /* Holds the value of the elapsed time the last the progress tick method
     was fired. */
  _previousElapsedTime : 0,
  /* Counts the number of ticks the player has been in buffering state. */
  _bufferingTicks : 0,
  /* Holds the volume value that was set before loading a track. */
  _volumeBeforeLoad : null,
  /* Counts the number of consecutive track load failures. */
  _loadFailureCount : 0,

  /**
   * Initializes the object.
   */
  init : function() {
    this._logger = FireFM.getLogger("FireFM.Player", "Info");
    this._logger.debug("init");

    this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
  },

  /**
   * Sets the internal player.
   * @param aAudio the <audio> node that will play the sound.
   */
  setPlayer : function(aAudio) {
    this._logger.info("setPlayer");

    let that = this;

    this._playerObj = aAudio;
    this._playerObj.addEventListener(
      "canplay", function(aEvent) { that.onTrackLoaded(aEvent); });
    this._playerObj.addEventListener(
      "ended", function(aEvent) { that.onTrackFinished(aEvent); });
    this._playerObj.addEventListener(
      "error", function(aEvent) { that.onLoadError(aEvent); });
  },

  /**
   * Event fired when a track has been loaded and is ready to play.
   */
  onTrackLoaded : function(aEvent) {
    this._logger.debug("onTrackLoaded");

    this._logger.info("onTrackLoaded: PLAY");
    this._playerObj.play();
  },

  /**
   * Event fired by the player when a track has failed loading.
   */
  onLoadError : function(aEvent) {
    this._logger.debug("onLoadError");

    this._logger.info("onTrackLoaded: ERROR");

    if (this._isPlaying) {
      this._loadFailureCount++;

      if (MAX_LOAD_FAILURES <= this._loadFailureCount) {
        FireFM.Station.stop();
        FireFM.obsService.notifyObservers(
          null, this.TOPIC_PLAYER_ERROR, this.STATUS_TRACK_LOAD_FAILED);
        this.stop();
      } else {
        this.skip();
      }
    }
  },

  /**
   * Event fired by the player when a track has finished playing.
   */
  onTrackFinished : function(aEvent) {
    this._logger.debug("onTrackFinished");

    this._logger.info("onTrackLoaded: FINISHED");
    this.skip();
  },

  /**
   * Loads a track in the player and starts playing it.
   * @param aURL The URL of the track to be loaded.
   */
  _loadTrack : function(aURL) {
    this._logger.trace("_loadTrack");

    if (null == this._volumeBeforeLoad) {
      this._volumeBeforeLoad = this.volume;
    }

    this._playerObj.pause();
    this._playerObj.src = aURL;
    this._playerObj.load();

    this._logger.info("onTrackLoaded: LOAD: " + this._playerObj.src);
  },

  /**
   * Begins playlist playback.
   */
  play : function() {
    this._logger.debug("play");

    let nextTrack = FireFM.Playlist.getNextTrack();

    if (null != nextTrack) {
      this._track = nextTrack;

      this._isPlaying = true;
      this._loadTrack(nextTrack.location);
      nextTrack.startTime = Math.floor((new Date()).getTime() / 1000);

      FireFM.obsService.notifyObservers(
        nextTrack, this.TOPIC_TRACK_LOADED, null);
    } else {
      // try to load a new playlist.
      FireFM.Station.play();
    }
  },

  /**
   * Skips the current track.
   */
  skip : function() {
    this._logger.debug("skip");

    this._bufferingTicks = 0;
    this._isBufferingValue = false;
    this._isPlaying = false;
    this.play();
  },

  /**
   * Stops track playback.
   */
  stop : function() {
    this._logger.debug("stop");

    this._bufferingTicks = 0;
    this._isBufferingValue = false;
    this._isPlaying = false;
    FireFM.obsService.notifyObservers(null, this.TOPIC_PLAYER_STOPPED, null);

    // XXX: this can be called even if the player isn't loaded.
    if (null != this._playerObj) {
      this._playerObj.pause();
    }
  },

  /**
   * Getter of the track that is currently loaded.
   * @return The track object.
   */
  get track() {
    this._logger.debug("track[get]");
    return this._track;
  },

  /**
   * Getter of the current player volume value.
   * @return The volume value (0 to 100).
   */
  get volume() {
    this._logger.debug("volume[get]");

    let volume;
    if (null != this._volumeBeforeLoad) {
      volume = this._volumeBeforeLoad;
    } else {
      volume = this._playerObj.volume * 100;
    }

    return volume;
  },

  /**
   * Sets the volume of the player if the given volume value is in the range of
   * 0 and 100.
   * @param aVolumeValue The new volume value to be set.
   */
  setVolume : function(aVolumeValue) {
    this._logger.debug("setVolume");

    if (0 <= aVolumeValue && aVolumeValue <= 100) {
      if (this.isPlaying) {
        this._playerObj.volume = aVolumeValue / 100;
      } else {
        this._volumeBeforeLoad = aVolumeValue;
      }
    }
  },

  /**
   * Getter of the track duration.
   * @return The track duration string.
   */
  get trackDuration() {
    this._logger.debug("trackDuration[get]");

    return this._toHumanTime(this.rawTrackDuration);
  },

  /**
   * Getter of the track elapsed time.
   * @return The elapsed time string.
   */
  get elapsedTime() {
    this._logger.debug("elapsedTime[get]");

    return this._toHumanTime(this.rawElapsedTime);
  },

  /**
   * Getter of the track remaining time.
   * @return The remaining time string.
   */
  get remainingTime() {
    this._logger.debug("remainingTime[get]");

    return this._toHumanTime(this.rawTrackDuration - this.rawElapsedTime);
  },

  /**
   * Getter of the raw track elapsed time.
   * @return The raw track elapsed time in miliseconds.
   */
  get rawElapsedTime() {
    this._logger.debug("rawElapsedTime[get]");

    let  elapsed = (this.isPlaying ? (this._playerObj.currentTime * 1000) : 0);

    return elapsed;
  },

  /**
   * Getter of the raw track duration time.
   * @return The raw track duration in miliseconds.
   */
  get rawTrackDuration() {
    this._logger.debug("rawTrackDuration[get]");
    return (null != this._track ? this._track.duration : 0);
  },

  /**
   * Whether the player is currently playing something.
   * @return True if playing, false if stopped.
   */
  get isPlaying() {
    this._logger.debug("isPlaying[get]");
    return this._isPlayingValue;
  },

  /**
   * Whether the player is buffering a track.
   * @return True if buffering, false otherwise.
   */
  get isBuffering() {
    this._logger.debug("isBuffering[get]");
    return this._isBufferingValue;
  },

  /**
   * Sets the value for the isPlaying property. It starts and stops the
   * progress check timer.
   */
  set _isPlaying(aValue) {
    this._logger.debug("_isPlaying[set]");

    if (this._isPlayingValue != aValue) {

      this._isPlayingValue = aValue;
      this._timer.cancel();

      if (this._isPlayingValue) {

        this._timer.initWithCallback(
          { notify: function(aTimer) { FireFM.Player._progressTick(); } },
          PROGRESS_TIMEOUT, Ci.nsITimer.TYPE_REPEATING_SLACK);

      } else {
        this._progressTick();
      }
    }
  },

  /**
   * Called every time the progress timer ticks. Calculates the isBuffering
   * property and notifies observers of the progress changed topic.
   */
  _progressTick : function() {
    // XXX: There is no logging here for efficiency reasons.

    let elapsed = this.rawElapsedTime;
    let duration = this.rawTrackDuration;

    // Restore the volume value that the player had before loading the track
    if (null != this._volumeBeforeLoad) {
      this.setVolume(this._volumeBeforeLoad);
      this._volumeBeforeLoad = null;
    }

    let per = (elapsed  * 100) / duration;

    // Calculate isBuffering
    if (this.isPlaying && elapsed == this._previousElapsedTime) {

      this._bufferingTicks++;
      this._isBufferingValue =
        (BUFFERING_TICKS_LIMIT <= this._bufferingTicks);

    } else {
      this._bufferingTicks = 0;
      this._isBufferingValue = false;
      this._previousElapsedTime = elapsed;
    }

    if (elapsed > 0) {
      this._loadFailureCount = 0;
    }

    FireFM.obsService.notifyObservers(null, this.TOPIC_PROGRESS_CHANGED, per);
  },

  /**
   * Converts a raw track time to a time string in the form of MM:SS, where M
   * is minute and S is second. A zero is added as a prefix to seconds less
   * than ten.
   * @param aTime The raw track time to be converted.
   * @returns The time string.
   */
  _toHumanTime : function(aTime) {
    this._logger.trace("_toHumanTime");

    if (0 > aTime) {
      aTime = 0;
    }

    var date = new Date(aTime);

    var sec = date.getSeconds();
    if (sec < 10) {
      sec = "0" + sec;
    }

    return (date.getMinutes() + ":" + sec);
  }
};}

/**
 * FireFM.Player constructor.
 */
(function() {
  this.init();
}).apply(FireFM.Player);
