How to release new version of MedTagger?
----------------------------------------

This document describes how new versions of MedTagger can be released.

## Nightly builds on Travis CI

Travis CI builds and release `nightly` versions of MedTagger on each CI build on `master` branch.
 Such versions follow format `{MAJOR}.{MINOR}.{RELEASE}_b{BUILD_NUMBER}` (example: `1.0.1_b123`).
 Latest nightly Docker images will also be marked with `nightly` tag in the Docker Hub.

## How to release stable version?

MedTagger's version is tracked in the `VERSION` file in the root directory of this repository. This file
 contains a single string value in format `{MAJOR}.{MINOR}.{RELEASE}`. It will be used to tag Docker
 images with appropriate versions automatically.

To do so, you can use existing Makefile entries and do this:

```bash
# Choose nightly version that you would like to promote to a stable version
$ export MEDTAGGER_VERSION=1.0.1_b123

# Pull such images from the Docker Hub
$ docker-compose pull medtagger_frontend medtagger_backend_rest \
medtagger_backend_websocket medtagger_backend_worker medtagger_backend_database_migrations

# Tag current version as latest versions of MedTagger
$ make docker_tag_as_latest

# Define new stable version and tag images as stable
$ export MEDTAGGER_VERSION=1.0.1
$ make docker_tag_as_stable

# Push images to Docker Hub
$ make docker_push_stable
```

Also, remember to release new version in GitHub Releases version through its UI.

The next step is to bump `VERSION` file in order te be prepared for new stable release. Choose what it
 should be, eg. we could work on the next major release or just a minor version.

That's all you need to know!
