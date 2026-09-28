import AppKit

private typealias CommandCallback = @convention(c) (Int32) -> Int32
private var callback: CommandCallback?
private var palette: NSPanel?
private var target: ProbeTarget?

private final class ProbeTarget: NSObject {
    @objc func run(_ sender: NSButton) {
        let result = callback?(1) ?? -1
        sender.title = "VBA returned \(result)"
    }
}

@_cdecl("FEProbeShow")
public func show(_ pointer: UnsafeMutableRawPointer?) {
    guard let pointer else { return }
    callback = unsafeBitCast(pointer, to: CommandCallback.self)
    if palette == nil {
        let panel = NSPanel(contentRect: NSRect(x: 100, y: 200, width: 168, height: 90),
                            styleMask: [.titled, .closable, .utilityWindow, .nonactivatingPanel],
                            backing: .buffered, defer: false)
        panel.title = "Free Elements · Native"
        panel.isFloatingPanel = true
        panel.hidesOnDeactivate = true
        panel.isReleasedWhenClosed = false
        let button = NSButton(title: "Test VBA connection", target: nil, action: #selector(ProbeTarget.run(_:)))
        target = ProbeTarget()
        button.target = target
        button.frame = NSRect(x: 8, y: 25, width: 152, height: 30)
        panel.contentView?.addSubview(button)
        palette = panel
    }
    palette?.orderFront(nil)
}

@_cdecl("FEProbeHide")
public func hide() {
    palette?.orderOut(nil)
    callback = nil
}
