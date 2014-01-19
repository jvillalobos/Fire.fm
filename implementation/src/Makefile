###
# Copyright (c) 2014, Jose Enrique Bolanos, Jorge Villalobos
# All rights reserved.
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions are met:
#
#  * Redistributions of source code must retain the above copyright notice,
#    this list of conditions and the following disclaimer.
#  * Redistributions in binary form must reproduce the above copyright notice,
#    this list of conditions and the following disclaimer in the documentation
#    and/or other materials provided with the distribution.
#  * Neither the name of Jose Enrique Bolanos, Jorge Villalobos nor the names of
#    its contributors may be used to endorse or promote products derived from
#    this software without specific prior written permission.
#
# THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
# "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
# LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
# A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER
# OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
# EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
# PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
# PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
# LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
# NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
# SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
###

# The name of the extension.
extension_name := firefm

# The UUID of the extension.
extension_uuid := {6F0976E6-26F3-4AFE-BBEC-9E99E27E4DF3}

# The name of the profile dir where the extension can be installed.
profile_dir := firefm-dev

# The zip application to be used.
ZIP := zip

# The target XPI file.
xpi_file := ../bin/$(extension_name).xpi

# The type of operating system this make command is running on.
os_type := $(patsubst darwin%,darwin,$(shell echo $(OSTYPE)))

# The location of the extension profile.
ifeq ($(os_type), darwin)
  profile_location := \
    ~/Library/Application\ Support/Firefox/Profiles/$(profile_dir)/extensions/
else
  ifeq ($(os_type), linux-gnu)
    profile_location := \
      ~/.mozilla/firefox/$(profile_dir)/extensions/
  else
    profile_location := \
      "$(subst \,\\,$(APPDATA))\\Mozilla\\Firefox\\Profiles\\$(profile_dir)\\extensions\\"
  endif
endif

# This builds the extension XPI file.
.PHONY: all
all: $(xpi_file)
	@echo
	@echo "Build finished successfully."
	@echo
	@echo "                                      Shut your mouth and take it home"
	@echo "                                cause I decide the way things gonna be"
	@echo "                                               - I Want Out, Helloween"

# This cleans all temporary files and directories created by 'make'.
.PHONY: clean
clean:
	@rm -f $(xpi_file)
	@echo "Cleanup is done."

# The sources for the XPI file.
xpi_built := install.rdf \
             chrome.manifest \
             icon.png \
             $(wildcard content/*.js) \
             $(wildcard content/*.xul) \
             $(wildcard content/*.xml) \
             $(wildcard content/*.css) \
             $(wildcard content/*.html) \
             $(wildcard skin/*/*.css) \
             $(wildcard skin/*/*.png) \
             $(wildcard locale/*/*.dtd) \
             $(wildcard locale/*/*.properties) \
             $(wildcard components/*.js) \
             $(wildcard resources/*.js) \
             defaults/preferences/$(extension_name).js \

$(xpi_file): $(xpi_built)
	@echo "Creating XPI file."
	@$(ZIP) $(xpi_file) $(xpi_built)
	@echo "Creating XPI file. Done!"

.PHONY: install
install: $(xpi_file)
	@echo "Installing in profile folder: $(profile_location)"
	@cp -fL $(xpi_file) $(profile_location)/$(extension_uuid).xpi
	@echo "Installing in profile folder. Done!"
	@echo
	@echo "                                 I was a creature before I could stand"
	@echo "                                       I will remember before I forget"
	@echo "                                           - Before I Forget, Slipknot"
