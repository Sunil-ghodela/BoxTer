# Homebrew Cask template for BoxTer.
#
# Homebrew casks live in a dedicated tap repo, not in the app repo itself.
# To publish this cask:
#
#   1. Create a public repo: github.com/Sunil-ghodela/homebrew-boxter
#   2. Commit this file there as: Casks/boxter.rb
#   3. After each release, bump `version` and replace both sha256 values.
#      Compute them with:
#        shasum -a 256 BoxTer-1.0.0.dmg BoxTer-1.0.0-arm64.dmg
#
# Users then install with:
#
#   brew tap sunil-ghodela/boxter
#   brew install --cask boxter

cask "boxter" do
  version "1.0.0"

  on_arm do
    url "https://github.com/Sunil-ghodela/BoxTer/releases/download/v#{version}/BoxTer-#{version}-arm64.dmg"
    sha256 "REPLACE_WITH_ARM64_DMG_SHA256"
  end

  on_intel do
    url "https://github.com/Sunil-ghodela/BoxTer/releases/download/v#{version}/BoxTer-#{version}.dmg"
    sha256 "REPLACE_WITH_X64_DMG_SHA256"
  end

  name "BoxTer"
  desc "Tiling workspace manager — terminals, browsers, and notes side by side"
  homepage "https://github.com/Sunil-ghodela/BoxTer"

  auto_updates false
  depends_on macos: ">= :big_sur"

  app "BoxTer.app"

  zap trash: [
    "~/Library/Application Support/BoxTer",
    "~/Library/Logs/BoxTer",
    "~/Library/Preferences/com.boxter.app.plist",
    "~/Library/Saved Application State/com.boxter.app.savedState",
  ]
end
