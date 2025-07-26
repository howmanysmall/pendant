#!/usr/bin/env sh

# Default variables
ASSET_TYPE="source" # source or release

# Parse command-line arguments
while [ $# -gt 0 ]; do
	case $1 in
	--release)
		ASSET_TYPE="release"
		;;
	--source)
		ASSET_TYPE="source"
		;;
	*)
		echo "Unknown option: $1"
		exit 1
		;;
	esac
	shift
done

# Detect operating system and architecture
OS=$(uname -s)
ARCH=$(uname -m)

case "$ASSET_TYPE" in
"release")
	# Map to release asset naming convention
	case "$OS" in
	"Darwin")
		if [ "$ARCH" = "x86_64" ]; then
			PLATFORM="macos-x64"
		elif [ "$ARCH" = "arm64" ]; then
			PLATFORM="macos-arm64"
		else
			echo "Unsupported macOS architecture: $ARCH"
			exit 1
		fi
		;;
	"Linux")
		if [ "$ARCH" = "x86_64" ]; then
			PLATFORM="ubuntu-x64"
		elif [ "$ARCH" = "aarch64" ]; then
			PLATFORM="ubuntu-arm64"
		else
			echo "Unsupported Linux architecture: $ARCH"
			exit 1
		fi
		;;
	"MINGW64_NT"* | "MSYS_NT"* | "CYGWIN_NT"*)
		if [ "$ARCH" = "x86_64" ]; then
			PLATFORM="windows-x64"
		else
			echo "Unsupported Windows architecture: $ARCH"
			exit 1
		fi
		;;
	*)
		echo "Unsupported operating system: $OS"
		exit 1
		;;
	esac

	echo "Detected platform: $PLATFORM"

	# Download the release asset for the current platform
	echo "Downloading pendant-$PLATFORM.tar.gz..."
	gh release download --repo howmanysmall/pendant --pattern "pendant-$PLATFORM.tar.gz"

	if [ $? -ne 0 ]; then
		echo "Failed to download release asset"
		exit 1
	fi

	# Extract the downloaded file
	echo "Extracting pendant-$PLATFORM.tar.gz to current-release/..."
	mkdir -p current-release
	tar -xzf "pendant-$PLATFORM.tar.gz" -C current-release/

	if [ $? -eq 0 ]; then
		echo "Successfully extracted release to current-release/"
		echo "Cleaning up downloaded archive..."
		rm "pendant-$PLATFORM.tar.gz"
	else
		echo "Failed to extract release"
		exit 1
	fi
	;;
"source")
	echo "Downloading source code..."
	gh release download --repo howmanysmall/pendant --archive=tar.gz

	if [ $? -ne 0 ]; then
		echo "Failed to download source code"
		exit 1
	fi

	# Extract source code
	echo "Extracting source code to current-release/..."
	mkdir -p current-release
	tar -xzf pendant-*.tar.gz -C current-release/ --strip-components=1

	if [ $? -eq 0 ]; then
		echo "Successfully extracted source code to current-release/"
		echo "Cleaning up downloaded archive..."
		rm pendant-*.tar.gz
	else
		echo "Failed to extract source code"
		exit 1
	fi
	;;
*)
	echo "Invalid asset type: $ASSET_TYPE"
	exit 1
	;;
esac
