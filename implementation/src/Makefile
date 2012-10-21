###
# Copyright (c) 2008, Jose Enrique Bolanos, Jorge Villalobos
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
extension_uuid := 6F0976E6-26F3-4AFE-BBEC-9E99E27E4DF3

# The name of the profile dir where the extension can be installed.
profile_dir := firefm-dev

# The zip application to be used.
ZIP := zip

# The target location of the build and build files.
bin_dir := ../bin

# The target XPI file.
xpi_file := $(bin_dir)/$(extension_name).xpi

# The type of operating system this make command is running on.
os_type := $(patsubst darwin%,darwin,$(shell echo $(OSTYPE)))

# The location of the extension profile.
ifeq ($(os_type), darwin)
  profile_location := \
    ~/Library/Application\ Support/Firefox/Profiles/$(profile_dir)/extensions/\{$(extension_uuid)\}
else
  ifeq ($(os_type), linux-gnu)
    profile_location := \
      ~/.mozilla/firefox/$(profile_dir)/extensions/\{$(extension_uuid)\}
  else
    profile_location := \
      "$(subst \,\\,$(APPDATA))\\Mozilla\\Firefox\\Profiles\\$(profile_dir)\\extensions\\{$(extension_uuid)}"
  endif
endif

# The temporary location where the extension tree will be copied and built.
build_dir := $(bin_dir)/build

# The install.rdf file.
install_rdf := install.rdf

# The chrome.manifest file.
chrome_manifest := chrome.manifest

# The default icon file.
default_icon := icon.png

# The defaults dir.
defaults_dir := defaults

# The resources dir.
resources_dir := resources

# The search plugins dir.
search_plugins_dir := searchplugins

# The preferences dir.
preferences_dir := $(defaults_dir)/preferences

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
	@rm -rf $(build_dir)
	@rm -f $(xpi_file)
	@echo "Cleanup is done."

# The includes are added after the targets because we want this file to contain
# the default (first) target.
include chrome/Makefile.in
include resources/Makefile.in
include searchplugins/Makefile.in
include components/Makefile.in

# The sources for the XPI file. Uses variables defined in the included
# Makefiles.
xpi_built := $(build_dir)/$(install_rdf) \
             $(build_dir)/$(chrome_manifest) \
             $(build_dir)/$(default_icon) \
             $(chrome_jar_file) \
             $(build_dir)/$(preferences_dir) \
             $(build_dir)/$(defaults_dir)/$(extension_name).swf \
             $(build_dir)/$(preferences_dir)/$(extension_name).js \
             $(addprefix $(build_dir)/,$(resources_sources)) \
             $(build_dir)/$(resources_dir)/fmSecret.js \
             $(addprefix $(build_dir)/,$(search_plugins_sources)) \
             $(components_js_targets) \
#             $(components_xpt) \


xpi_built_no_dir := $(subst $(build_dir)/,,$(xpi_built))

# This builds everything except for the actual XPI, and then it copies it to the
# specified profile directory, allowing a quick update that requires no install.
.PHONY: install
install: $(build_dir) $(xpi_built)
	@echo "Installing in profile folder: $(profile_location)"
	@cp -Rf $(build_dir)/* $(profile_location)
	@echo "Installing in profile folder. Done!"
	@echo
	@echo "                                 I was a creature before I could stand"
	@echo "                                       I will remember before I forget"
	@echo "                                           - Before I Forget, Slipknot"

$(xpi_file): $(build_dir) $(xpi_built)
	@echo "Creating XPI file."
	@cd $(build_dir); $(ZIP) -D ../$(xpi_file) $(xpi_built_no_dir) $(defaults_dir)
	@echo "Creating XPI file. Done!"

$(build_dir)/$(resources_dir)/fmSecret.js: $(bin_dir)/fmSecret.js $(build_dir)/$(resources_dir)
	@cp -f $< $@

$(build_dir)/$(resources_dir)/%: $(resources_dir)/% $(build_dir)/$(resources_dir)
	@cp -f $< $@

$(build_dir)/$(search_plugins_dir)/%: $(search_plugins_dir)/% $(build_dir)/$(search_plugins_dir)
	@cp -f $< $@

$(build_dir)/$(defaults_dir)/%: $(defaults_dir)/% $(build_dir)/$(defaults_dir)
	@cp -f $< $@

$(build_dir)/$(preferences_dir)/%: \
  $(preferences_dir)/% $(build_dir)/$(preferences_dir)
	@cp -f $< $@

$(build_dir)/%: %
	@cp -f $< $@

$(build_dir):
	@if [ ! -x $(build_dir) ]; \
  then \
    mkdir $(build_dir); \
  fi

$(build_dir)/$(resources_dir):
	@if [ ! -x $(build_dir)/$(resources_dir) ]; \
  then \
    mkdir $(build_dir)/$(resources_dir); \
  fi

$(build_dir)/$(search_plugins_dir):
	@if [ ! -x $(build_dir)/$(search_plugins_dir) ]; \
  then \
    mkdir $(build_dir)/$(search_plugins_dir); \
  fi

$(build_dir)/$(defaults_dir):
	@if [ ! -x $(build_dir)/$(defaults_dir) ]; \
  then \
    mkdir $(build_dir)/$(defaults_dir); \
  fi

$(build_dir)/$(preferences_dir): $(build_dir)/$(defaults_dir)
	@if [ ! -x $(build_dir)/$(preferences_dir) ]; \
  then \
    mkdir $(build_dir)/$(preferences_dir); \
  fi
