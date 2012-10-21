/**
 * Copyright (c) 2008, Jose Enrique Bolanos, Jorge Villalobos
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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://firefm/fmCommon.js");
Components.utils.import("resource://firefm/fmEntities.js");

/**
 * Represents the currently playing playlist.
 */
FireFM.Playlist = {

  /* Logger for this object. */
  _logger : null,

  /* Playlist title. */
  _title : null,
  /* Array of tracks. */
  _tracks : new Array(),
  /* The track currently being played. */
  _currentTrack : null,
  /* Expiration of playlist (?). */
  _expiry : null,

  /**
   * Returns the title of the current playlist.
   * @return the title of the current playlist.
   */
  get title() {
    this._logger.trace("[getter] title");

    return this._title;
  },

  /**
   * Returns the expiration of the current playlist.
   * @return the expiration of the current playlist.
   */
  get expiry() {
    this._logger.trace("[getter] expiry");

    return this._expiry;
  },

  /**
   * Returns the track that is currently being played.
   * @return the track that is currently being played.
   */
  get currentTrack() {
    // XXX: no logging here for performance reasons.
    return this._currentTrack;
  },

  /**
   * Gets the next track on the playlist.
   * @return Track object with the next track to play. Returns null if there are
   * no more tracks to play in this playlist.
   */
  getNextTrack : function() {
    this._logger.debug("getNextTrack");
    this._currentTrack = null;

    if (this.hasMoreTracks()) {
      this._currentTrack = this._tracks.shift();
    }

    return this._currentTrack;
  },

  /**
   * Indicates if there are more tracks left in the playlist.
   * @return true if there are more tracks left in the playlist, false
   * otherwise.
   */
  hasMoreTracks: function() {
    this._logger.debug("hasMoreTracks");

    return (0 < this._tracks.length);
  },

  /**
   * Sets a new playlist.
   * @param aDocument the XML document that contains the playslist.
   */
  setNewPlaylist : function(aDocument) {
    this._logger.debug("setNewPlaylist");

    let playlist = aDocument.getElementsByTagName("playlist")[0];
    let playlistItems = playlist.childNodes;
    let playlistItemCount = playlistItems.length;
    let playlistItem;

    // reset the playlist before making any changes.
    this.clearPlaylist();

    for (let i = 0; i < playlistItemCount; i++) {
      playlistItem = playlistItems[i];

      switch (playlistItem.tagName) {
        case "title":
          this._title = FireFM.decodeFMString(playlistItem.textContent);
          break;
        case "link":
          let relAtt = playlistItem.getAttribute("rel");

          if ("http://www.last.fm/expiry" == relAtt) {
            this._expiry = playlistItem.textContent;
          }

          break;
        case "trackList":
          let tracks = playlistItem.childNodes;
          let trackCount = tracks.length;
          let trackItem;

          for (let j = 0; j < trackCount; j++) {
            trackItem = tracks[j];

            if ("track" == trackItem.tagName) {
              this._tracks.push(this._createTrack(trackItem));
            }
          }

          this._logger.debug(
            "setNewPlaylist. Track count: " + this._tracks.length);
          break;
      }
    }
  },

  /**
   * Creates a Track object from a node that should correspond to a playlist
   * track.
   * @param aTrackNode the track node to convert to a Track object.
   * @return Track object that corresponds to the information in the input node.
   */
  _createTrack : function(aTrackNode) {
    this._logger.trace("_createTrack");

    let track = null;
    let trackFields = new Array();
    let trackChildren = aTrackNode.childNodes;
    let extension = aTrackNode.getElementsByTagName("extension");
    let trackChildrenCount = trackChildren.length;
    let trackChild;

    for (let i = 0; i < trackChildrenCount; i ++) {
      trackChild = trackChildren[i];

      switch (trackChild.tagName) {
        case "identifier":
          trackFields[0] = trackChild.textContent;
          break;
        case "location":
          trackFields[1] = trackChild.textContent;
          break;
        case "title":
          trackFields[2] = FireFM.decodeFMString(trackChild.textContent);
          break;
        case "recording":
          trackFields[3] = trackChild.textContent;
          break;
        case "album":
          trackFields[4] = FireFM.decodeFMString(trackChild.textContent);
          break;
        case "creator":
          trackFields[5] = FireFM.decodeFMString(trackChild.textContent);
          break;
        case "duration":
          trackFields[6] = trackChild.textContent;
          break;
        case "image":
          trackFields[7] = trackChild.textContent;
          break;

        // XXX: deprecated: all of these should go when the old version of the
        // playlist format is no longer supported.
        case "id":
          trackFields[0] = trackChild.textContent;
          break;
        case "lastfm:trackauth":
          trackFields[8] = trackChild.textContent;
          break;
        case "lastfm:albumId":
          trackFields[9] = trackChild.textContent;
          break;
        case "lastfm:artistId":
          trackFields[10] = trackChild.textContent;
          break;
        case "link":
          let relAtt = trackChild.getAttribute("rel");

          switch (relAtt) {
            case "http://www.last.fm/artistpage":
              trackFields[11] = trackChild.textContent;
              break;
            case "http://www.last.fm/albumpage":
              trackFields[12] = trackChild.textContent;
              break;
            case "http://www.last.fm/trackpage":
              trackFields[13] = trackChild.textContent;
              break;
            case "http://www.last.fm/buyTrackURL":
              trackFields[14] = trackChild.textContent;
              break;
            case "http://www.last.fm/buyAlbumURL":
              trackFields[15] = trackChild.textContent;
              break;
            case "http://www.last.fm/freeTrackURL":
              trackFields[16] = trackChild.textContent;
              break;
          }

          break;
      }
    }

    // add the extension nodes to the list. This only applies to the new
    // playlist format.
    if (0 < extension.length) {
      trackChildren = extension[0].childNodes;
      trackChildrenCount = trackChildren.length;

      for (let i = 0; i < trackChildrenCount; i ++) {
        trackChild = trackChildren[i];

        switch (trackChild.tagName) {
          case "recording":
            trackFields[3] = trackChild.textContent;
            break;
          case "trackauth":
            trackFields[8] = trackChild.textContent;
            break;
          case "albumId":
            trackFields[9] = trackChild.textContent;
            break;
          case "artistId":
            trackFields[10] = trackChild.textContent;
            break;
          case "artistpage":
            trackFields[11] = trackChild.textContent;
            break;
          case "albumpage":
            trackFields[12] = trackChild.textContent;
            break;
          case "trackpage":
            trackFields[13] = trackChild.textContent;
            break;
          case "buyTrackURL":
            trackFields[14] = trackChild.textContent;
            break;
          case "buyAlbumURL":
            trackFields[15] = trackChild.textContent;
            break;
          case "freeTrackURL":
            trackFields[16] = trackChild.textContent;
            break;
        }
      }
    }

    track =
      new FireFM.Track(
        trackFields[0], trackFields[1], trackFields[2], trackFields[3],
        trackFields[4], trackFields[5], trackFields[6], trackFields[7],
        trackFields[8], trackFields[9], trackFields[10], trackFields[11],
        trackFields[12], trackFields[13], trackFields[14], trackFields[15],
        trackFields[16]);

    return track;
  },

  /**
   * Clears the playlist.
   */
  clearPlaylist : function() {
    this._logger.debug("clearPlaylist");
    this._title = null;
    this._tracks.splice(0, this._tracks.length);
    this._currentTrack = null;
    this._expiry = null;
  }
};

/**
 * FireFM.Playlist constructor.
 */
(function() {
  this._logger = FireFM.getLogger("FireFM.Playlist");
  this._logger.debug("init");
}).apply(FireFM.Playlist);
