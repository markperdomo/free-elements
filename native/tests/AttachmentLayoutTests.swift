import AppKit

// Run with swiftc native/macos/FreeElements.swift this-file -o <test binary>.
// These checks exercise screen/window geometry without opening an application.
@main enum AttachmentLayoutTests {
    static func main() {
        let size = NSSize(width: 176, height: 550)
        let screen = NSRect(x: 0, y: 24, width: 1366, height: 744)
        let full = PaletteAttachmentLayout.frame(host: screen, screen: screen, size: size)
        precondition(full == NSRect(x: 1182, y: 83, width: 176, height: 550), "13-inch display: keep ribbon clear and panel on screen")

        let host = NSRect(x: 100, y: 80, width: 900, height: 650)
        let first = PaletteAttachmentLayout.frame(host: host, screen: screen, size: size)
        let moved = PaletteAttachmentLayout.frame(host: host.offsetBy(dx: 50, dy: 10), screen: screen, size: size)
        precondition(moved == first.offsetBy(dx: 50, dy: 10), "Panel must track a document move")
        var resized = host; resized.size.width -= 180
        let narrow = PaletteAttachmentLayout.frame(host: resized, screen: screen, size: size)
        precondition(narrow.maxX == first.maxX - 180 && narrow.width == 176, "Track right edge during resizing without widening palette")

        let short = PaletteAttachmentLayout.frame(host: NSRect(x: -100, y: 50, width: 500, height: 400), screen: screen, size: size)
        precondition(short == NSRect(x: 216, y: 58, width: 176, height: 300), "Short and partially off-screen windows must stay usable")

        let secondary = NSRect(x: -1440, y: 0, width: 1440, height: 876)
        let second = PaletteAttachmentLayout.frame(host: secondary, screen: secondary, size: size)
        precondition(second.maxX == -8 && second.width == 176 && secondary.contains(second), "Negative-origin displays must not jump to primary screen")

        var cases = 5
        for display in [screen, secondary] {
            for width: CGFloat in [600, 1000, 1600] {
                for height: CGFloat in [320, 500, 900] {
                    for xOffset: CGFloat in [-200, 100, 1800] {
                        let window = NSRect(x: display.minX + xOffset, y: display.minY + 20, width: width, height: height)
                        let frame = PaletteAttachmentLayout.frame(host: window, screen: display, size: size)
                        precondition(display.contains(frame), "All controls must remain on the selected display")
                        precondition(frame.width > 0 && frame.height > 0 && frame.width <= 176 && frame.height <= 550)
                        cases += 1
                    }
                }
            }
        }
        print("PASS \(cases) attachment layout cases")
    }
}
