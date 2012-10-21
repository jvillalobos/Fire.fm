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

build_dir := build

source_files := $(wildcard *.html) \
                $(wildcard *.js) \
                $(wildcard *.ico) \
                $(wildcard *.xpi) \
                .htaccess \
                $(filter-out $(build_dir)/%,$(wildcard */*.html)) \
                $(filter-out $(build_dir)/%,$(wildcard */*.js)) \
                $(wildcard skin/*.css) \
                $(wildcard skin/*.jpg) \
                $(wildcard skin/*.png) \
                $(wildcard skin/*.gif)

target_files := $(addprefix $(build_dir)/,$(source_files))

# This copies all files to the server.
.PHONY: all
all: session $(target_files)
	@echo
	@echo "Files uploaded successfully."
	@echo
	@echo "                                                  Dreamers come and go"
	@echo "                                                 but a dream's forever"
	@echo "                                         - Into the Unknown, Avantasia"

# This cleans all temporary files and directories created by 'make'.
.PHONY: clean
clean:
	@rm -rf $(build_dir)/*
	@echo "Cleanup is done."

.PHONY: session
session:
	@echo "Creating session."
	@ssh-add $(FIREFM_KEY)
	@echo "Session created successfully."

# XXX: the remote folder creation part only works with one level of
# sub-directories
$(build_dir)/%: %
	@echo "Uploading $<"
	@scp -B $< $(FIREFM_USER),firefm@web.sourceforge.net:/home/groups/f/fi/firefm/htdocs/$(dir $<)
	@cp -Rf $< $@

# TODO: This used to work, but now ssh is completely disabled. We need to find
# a way to do it with the current system.
#	@if [ ! -x $(dir $@) ]; \
#  then \
#    ssh -i $(FIREFM_KEY) $(FIREFM_USER),firefm@web.sourceforge.net "mkdir /home/groups/f/fi/firefm/htdocs/$(dir $<)"; \
#    mkdir -p $(dir $@); \
#  fi
