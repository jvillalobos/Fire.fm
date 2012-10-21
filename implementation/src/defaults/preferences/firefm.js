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

// First run.
pref("extensions.firefm.stationFirstRun", true);

// Playback.
pref("extensions.firefm.autoplay", true);
pref("extensions.firefm.autoplay.notified", false);

// Appearance
pref("extensions.firefm.showInStatusBar", false);
pref(
  "extensions.firefm.statusBarButtons",
  "firefm-status-station-button,firefm-status-play-stop-button,firefm-status-skip-button,firefm-status-track-info[large],firefm-status-volume-button,firefm-status-amazon-button,firefm-status-tag-button,firefm-status-love-button,firefm-status-ban-button");

// Scrobble.
pref("extensions.firefm.scrobble", true);

// History.
pref("extensions.firefm.recent.enabled", true);
pref("extensions.firefm.recent.historySize", 10);
pref("extensions.firefm.recent.history", "[]");
pref("extensions.firefm.storeHistory", true);

// Gestures.
pref("extensions.firefm.useGestures", false);
pref("extensions.firefm.banGestureTime", 2000);

// Others.
pref("extensions.firefm.notifications.mode", 1);
pref("extensions.firefm.volume.mode", 0);
pref("extensions.firefm.volumeLevel", 100);
pref("extensions.firefm.enablePrivateMode", true);
pref("extensions.firefm.lastUser", "");
