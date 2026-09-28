import AppKit

// In-process C ABI. PowerPoint owns the main event loop; no sockets or helper process.
private typealias FECallback = @convention(c) (Int32) -> Int32
private var controller: PaletteController?
private var callback: FECallback?
private var inCommand = false

// Screen coordinates can be negative on secondary displays. Keep the palette
// inside the visible part of its host; attachment does not resize the slide area.
enum PaletteAttachmentLayout {
    static func frame(host: NSRect, screen: NSRect, size: NSSize) -> NSRect {
        let intersection = host.intersection(screen)
        let visible = intersection.isNull || intersection.isEmpty ? screen : intersection
        let margin: CGFloat = 8
        let width = min(size.width, max(1, visible.width - 2 * margin))
        let topInset = min(135, max(margin, visible.height - 300 - margin))
        let top = visible.maxY - topInset
        let height = min(size.height, max(1, top - visible.minY - margin))
        return NSRect(x: visible.maxX - margin - width, y: top - height,
                      width: width, height: height)
    }
}

private final class PalettePanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}

private final class PaletteController: NSObject, NSWindowDelegate {
    let panel: PalettePanel
    let status = NSTextField(wrappingLabelWithString: "Select shapes in PowerPoint.")
    var numbers: [Int: NSTextField] = [:]
    var toggles: [Int: NSButton] = [:]
    var menus: [Int: NSPopUpButton] = [:]
    var colors: [Int: NSColorWell] = [:]
    var textFields: [Int: NSTextField] = [:]
    var buttons: [NSButton] = []
    let options = NSStackView()
    let presetName = NSTextField(string: "")
    let presetMenu = NSPopUpButton()
    let root = NSStackView()
    let defaults = UserDefaults(suiteName: "org.freeelements.palette")!
    let attachmentButton = NSButton()
    private weak var hostWindow: NSWindow?
    private var hostWindowClass: String?
    private var attachesToRight = true
    private var isPresented = false
    private var observingWindows = false
    private var preferredPaletteSize = NSSize(width: 176, height: 540)
    private var floatingFrame: NSRect?

    override init() {
        panel = PalettePanel(contentRect: NSRect(x: 40, y: 200, width: 176, height: 480),
            styleMask: [.titled, .closable, .utilityWindow, .nonactivatingPanel], backing: .buffered, defer: false)
        super.init()
        panel.title = "Free Elements"
        panel.isFloatingPanel = true
        panel.becomesKeyOnlyIfNeeded = true
        panel.worksWhenModal = false
        panel.hidesOnDeactivate = true
        panel.isReleasedWhenClosed = false
        panel.delegate = self
        panel.collectionBehavior = [.fullScreenAuxiliary]
        panel.setFrameAutosaveName("FreeElementsNativePalette")
        panel.minSize = NSSize(width: 176, height: 300)
        let scroll = NSScrollView()
        scroll.hasVerticalScroller = true
        scroll.autohidesScrollers = true
        scroll.drawsBackground = false
        panel.contentView = scroll
        root.orientation = .vertical
        root.alignment = .leading
        root.spacing = 2
        root.edgeInsets = NSEdgeInsets(top: 7, left: 7, bottom: 7, right: 7)
        root.translatesAutoresizingMaskIntoConstraints = false
        scroll.documentView = root
        NSLayoutConstraint.activate([root.widthAnchor.constraint(equalToConstant: 176)])

        attachesToRight = defaults.object(forKey: "attachRight") as? Bool ?? true
        attachmentButton.setButtonType(.pushOnPushOff)
        attachmentButton.bezelStyle = .recessed
        attachmentButton.isBordered = false
        attachmentButton.imagePosition = .imageOnly
        attachmentButton.image = NSImage(systemSymbolName: "sidebar.right", accessibilityDescription: "Attach to right side")
        attachmentButton.symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 13, weight: .regular)
        attachmentButton.target = self
        attachmentButton.action = #selector(toggleAttachment(_:))
        attachmentButton.setAccessibilityLabel("Attach to right side")
        attachmentButton.widthAnchor.constraint(equalToConstant: 25).isActive = true
        attachmentButton.heightAnchor.constraint(equalToConstant: 24).isActive = true
        updateAttachmentButton()
        let ref = popup(1, ["Ref: first", "Ref: last", "Ref: pinned"], width: 104)
        row([ref, button(90, "pin", "Pin the single selected shape as reference"), attachmentButton])
        section("Position")
        row([button(101,"align.horizontal.left","Align left"), button(102,"align.horizontal.center","Align centers"), button(103,"align.horizontal.right","Align right"), button(104,"align.vertical.top","Align top"), button(105,"align.vertical.center","Align middles"), button(106,"align.vertical.bottom","Align bottom")])
        row([popup(2,["To reference", "Selection bounds", "Slide"],width: 159)])
        section("Spacing")
        row([label("Gap"), field(3,24,width:40), label("Cols"), field(4,2,width:33)])
        row([button(201,"distribute.horizontal.center","Equal horizontal gaps"), button(202,"distribute.vertical.center","Equal vertical gaps"),button(203,"arrow.left.and.right","Fixed horizontal spacing"),button(204,"arrow.up.and.down","Fixed vertical spacing"),button(205,"square.grid.2x2","Arrange grid"),button(206,"arrow.triangle.swap","Swap shape centers")])
        section("Size")
        row([button(301,"arrow.left.and.right.square","Match width"),button(302,"arrow.up.and.down.square","Match height"),button(303,"arrow.up.left.and.arrow.down.right.square","Match width and height"),popup(5,["Centers","Top left"],width:81)])
        section("Shape")
        row([button(401,"angle","Match point angles"),button(402,"chevron.forward.2","Align chevron process chain"),button(403,"slider.horizontal.3","Match adjustment handles"),button(404,"arrow.right","Set arrow proportions"),button(405,"rectangle.roundedtop","Set corner radius")])
        section("Format")
        for (key,name,hex) in [(10,"Fill",0xE7EDDE),(11,"Line",0x72816A),(12,"Text",0x24372B)] {
            let check=NSButton(checkboxWithTitle:name,target:nil,action:nil)
            check.font = .systemFont(ofSize:10)
            check.state = .on
            check.widthAnchor.constraint(equalToConstant:49).isActive=true
            toggles[key]=check
            let well=NSColorWell()
            well.color = color(hex)
            well.controlSize = .mini
            well.widthAnchor.constraint(equalToConstant:38).isActive=true
            well.heightAnchor.constraint(equalToConstant:18).isActive=true
            well.setAccessibilityLabel("\(name) color")
            colors[key]=well
            if key==10 { row([check,well,button(501,"eyedropper","Capture reference format"),button(502,"paintbrush","Apply checked formatting")]) }
            else if key==11 { row([check,well,label("pt"),field(13,1,width:37)]) }
            else { row([check,well,field(14,18,width:37),checkBox(15,"B",false)]) }
        }
        let font = NSTextField(string: defaults.string(forKey:"font") ?? "Arial")
        font.font = .systemFont(ofSize:10)
        font.controlSize = .small
        font.setAccessibilityLabel("Font family")
        font.widthAnchor.constraint(equalToConstant:159).isActive=true
        textFields[1]=font
        row([font])
        section("Text")
        row([button(601,"arrow.up.left.and.arrow.down.right","Fit shape to text"),button(602,"textformat.size.smaller","Shrink text to fit"),button(603,"text.word.spacing","Toggle word wrap"),button(604,"scissors","Split paragraph copies"),button(605,"text.badge.plus","Merge text copy"),button(606,"xmark.square","Disable autofit")])
        row([button(607,"list.bullet","Add bullets"),button(608,"list.number","Add numbering"),button(609,"text.alignleft","Remove bullets and numbering"),button(610,"decrease.indent","Decrease indent"),button(611,"increase.indent","Increase indent"),button(612,"rectangle.inset.filled","Apply text margins")])
        let disclosure=NSButton(title:"Values & options",target:self,action:#selector(toggleOptions(_:)))
        disclosure.bezelStyle = .inline
        disclosure.font = .systemFont(ofSize:10)
        disclosure.setAccessibilityLabel("Show values and options")
        row([disclosure,button(0,"arrow.clockwise","Refresh selection")])
        options.orientation = .vertical
        options.alignment = .leading
        options.spacing = 3
        options.isHidden = true
        root.addArrangedSubview(options)
        option("Radius",field(20,10,width:65))
        option("Arrow head",field(21,24,width:65))
        option("Shaft %",field(22,50,width:65))
        option("Margin left",field(30,7.2,width:65))
        option("Margin right",field(31,7.2,width:65))
        option("Margin top",field(32,3.6,width:65))
        option("Margin bottom",field(33,3.6,width:65))
        let more=NSStackView(views:[button(613,"minus.rectangle","Reduce all text margins by 1 pt"),button(614,"plus.rectangle","Increase all text margins by 1 pt"),button(615,"text.alignleft","Align paragraphs left"),button(616,"text.aligncenter","Center paragraphs"),button(617,"text.alignright","Align paragraphs right")])
        more.spacing=2
        options.addArrangedSubview(more)
        let savedLabel=label("Saved formats")
        options.addArrangedSubview(savedLabel)
        presetName.placeholderString="Format name"
        presetName.font = .systemFont(ofSize:10)
        presetName.controlSize = .mini
        presetName.setAccessibilityLabel("Format preset name")
        presetName.widthAnchor.constraint(equalToConstant:126).isActive=true
        let save=NSButton(title:"+",target:self,action:#selector(savePreset))
        save.bezelStyle = .inline
        save.setAccessibilityLabel("Save format preset")
        let saveRow=NSStackView(views:[presetName,save]);saveRow.spacing=2;options.addArrangedSubview(saveRow)
        presetMenu.controlSize = .mini
        presetMenu.font = .systemFont(ofSize:10)
        presetMenu.widthAnchor.constraint(equalToConstant:101).isActive=true
        presetMenu.setAccessibilityLabel("Saved formats")
        let load=NSButton(title:"↓",target:self,action:#selector(loadPreset))
        load.bezelStyle = .inline;load.setAccessibilityLabel("Load format preset")
        let remove=NSButton(title:"−",target:self,action:#selector(removePreset))
        remove.bezelStyle = .inline;remove.setAccessibilityLabel("Remove format preset")
        let loadRow=NSStackView(views:[presetMenu,load,remove]);loadRow.spacing=2;options.addArrangedSubview(loadRow)
        refreshPresets()
        let note=NSTextField(wrappingLabelWithString:"Measurements in points. Split / merge create editable copies and keep originals. Shapes are detected automatically.")
        note.font = .systemFont(ofSize:9)
        note.textColor = .secondaryLabelColor
        note.widthAnchor.constraint(equalToConstant:158).isActive=true
        options.addArrangedSubview(note)
        status.font = .systemFont(ofSize:9)
        status.textColor = .secondaryLabelColor
        status.setAccessibilityLabel("Command status")
        status.widthAnchor.constraint(equalToConstant:158).isActive=true
        status.heightAnchor.constraint(greaterThanOrEqualToConstant:22).isActive=true
        root.addArrangedSubview(status)
        let foot=label("Native · ⌘Z on slide")
        foot.textColor = .tertiaryLabelColor
        root.addArrangedSubview(foot)
        root.layoutSubtreeIfNeeded()
        panel.setContentSize(NSSize(width:176,height:min(540,root.fittingSize.height)))
        preferredPaletteSize = panel.frame.size
        if !panel.setFrameUsingName("FreeElementsNativePalette"), let frame=NSScreen.main?.visibleFrame {
            panel.setFrameTopLeftPoint(NSPoint(x:frame.maxX-188,y:frame.maxY-135))
        }
        if let saved = defaults.string(forKey: "floatingFrame") {
            let frame = NSRectFromString(saved)
            if frame.width > 0 && frame.height > 0 { floatingFrame = frame }
        }
    }
    private func updateAttachmentButton() {
        attachmentButton.state = attachesToRight ? .on : .off
        attachmentButton.contentTintColor = attachesToRight ? .controlAccentColor : .labelColor
        attachmentButton.toolTip = attachesToRight ? "Detach from PowerPoint and float freely" : "Attach to the right side of PowerPoint"
    }
    private func isDocumentWindow(_ window: NSWindow) -> Bool {
        // Capture the host's window class on explicit launch. Never attach to a
        // dialog, color picker, the VBA editor, or an arbitrary ordered window.
        guard window !== panel, !(window is NSPanel), window.canBecomeMain,
              window.styleMask.contains(.resizable), window.sheetParent == nil,
              !window.title.hasPrefix("Microsoft Visual Basic") else { return false }
        return hostWindowClass == nil || NSStringFromClass(type(of: window)) == hostWindowClass
    }
    func show() {
        isPresented = true
        startObservingWindows()
        if attachesToRight, let window = NSApp.mainWindow, isDocumentWindow(window) {
            attach(to: window)
        } else if !attachesToRight {
            restoreFloatingFrame()
        }
        panel.orderFront(nil)
    }
    func hide() {
        isPresented = false
        NotificationCenter.default.removeObserver(self)
        observingWindows = false
        detach()
        hostWindowClass = nil
        panel.orderOut(nil)
        callback = nil
    }
    private func attach(to window: NSWindow) {
        guard window.attachedSheet == nil, !window.isMiniaturized else { return }
        if hostWindow !== window {
            if panel.parent == nil && floatingFrame == nil { floatingFrame = panel.frame }
            detach()
            hostWindow = window
            hostWindowClass = NSStringFromClass(type(of: window))
            window.addChildWindow(panel, ordered: .above)
        }
        panel.isMovable = false
        positionAtRightEdge()
    }
    private func detach() {
        panel.parent?.removeChildWindow(panel)
        hostWindow = nil
        panel.isMovable = true
    }
    private func positionAtRightEdge() {
        guard attachesToRight, let host = hostWindow,
              let screen = host.screen ?? panel.screen ?? NSScreen.main else { return }
        let frame = PaletteAttachmentLayout.frame(host: host.frame, screen: screen.visibleFrame, size: preferredPaletteSize)
        if panel.frame != frame { panel.setFrame(frame, display: true, animate: false) }
    }
    private func restoreFloatingFrame() {
        guard let screen = panel.screen ?? NSScreen.main else { return }
        var frame = floatingFrame ?? panel.frame
        frame.size = preferredPaletteSize
        frame.origin.x = max(screen.visibleFrame.minX, min(frame.minX, screen.visibleFrame.maxX - frame.width))
        frame.origin.y = max(screen.visibleFrame.minY, min(frame.minY, screen.visibleFrame.maxY - frame.height))
        panel.setFrame(frame, display: true, animate: false)
    }
    @objc private func toggleAttachment(_ sender: NSButton) {
        attachesToRight = sender.state == .on
        defaults.set(attachesToRight, forKey: "attachRight")
        updateAttachmentButton()
        if attachesToRight {
            floatingFrame = panel.frame
            defaults.set(NSStringFromRect(panel.frame), forKey: "floatingFrame")
            if let window = NSApp.mainWindow, isDocumentWindow(window) { attach(to: window) }
        } else {
            detach()
            restoreFloatingFrame()
        }
    }
    private func startObservingWindows() {
        guard !observingWindows else { return }
        observingWindows = true
        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(mainWindowChanged(_:)), name: NSWindow.didBecomeMainNotification, object: nil)
        for name in [NSWindow.didMoveNotification, NSWindow.didResizeNotification,
                     NSWindow.didChangeScreenNotification, NSWindow.didEnterFullScreenNotification,
                     NSWindow.didExitFullScreenNotification, NSWindow.didDeminiaturizeNotification] {
            center.addObserver(self, selector: #selector(hostGeometryChanged(_:)), name: name, object: nil)
        }
        center.addObserver(self, selector: #selector(hostClosing(_:)), name: NSWindow.willCloseNotification, object: nil)
    }
    @objc private func mainWindowChanged(_ note: Notification) {
        guard isPresented, attachesToRight, NSApp.modalWindow == nil,
              let window = note.object as? NSWindow, isDocumentWindow(window) else { return }
        attach(to: window)
    }
    @objc private func hostGeometryChanged(_ note: Notification) {
        guard isPresented, let window = note.object as? NSWindow, window === hostWindow else { return }
        positionAtRightEdge()
    }
    @objc private func hostClosing(_ note: Notification) {
        if let window = note.object as? NSWindow, window === hostWindow { hide() }
    }
    func windowDidMove(_ notification: Notification) {
        guard !attachesToRight, isPresented else { return }
        floatingFrame = panel.frame
        defaults.set(NSStringFromRect(panel.frame), forKey: "floatingFrame")
    }
    func color(_ hex:Int)->NSColor { NSColor(srgbRed:CGFloat((hex>>16)&255)/255,green:CGFloat((hex>>8)&255)/255,blue:CGFloat(hex&255)/255,alpha:1) }
    func label(_ title:String)->NSTextField { let t=NSTextField(labelWithString:title); t.font = .systemFont(ofSize:10); return t }
    func row(_ views:[NSView]) { let s=NSStackView(views:views); s.spacing=2; s.alignment = .centerY; root.addArrangedSubview(s) }
    func section(_ title:String) {
        let line=NSBox(); line.boxType = .separator; line.widthAnchor.constraint(equalToConstant:160).isActive=true
        root.addArrangedSubview(line)
        let t=label(title); t.font = .systemFont(ofSize:10,weight:.medium); t.textColor = .secondaryLabelColor
        root.addArrangedSubview(t)
    }
    func option(_ title:String,_ view:NSView) {let l=label(title);l.widthAnchor.constraint(equalToConstant:91).isActive=true;let s=NSStackView(views:[l,view]);s.spacing=2;options.addArrangedSubview(s)}
    func field(_ key:Int,_ value:Double,width:CGFloat)->NSTextField {
        let t=NSTextField(string:String(format:"%g",defaults.object(forKey:"n\(key)") as? Double ?? value))
        t.font = .monospacedDigitSystemFont(ofSize:10,weight:.regular);t.controlSize = .mini;t.alignment = .right
        t.widthAnchor.constraint(equalToConstant:width).isActive=true
        let names=[3:"Gap in points",4:"Grid columns",13:"Outline width",14:"Font size",20:"Corner radius",21:"Arrowhead depth",22:"Shaft percentage",30:"Left text margin",31:"Right text margin",32:"Top text margin",33:"Bottom text margin"]
        t.setAccessibilityLabel(names[key] ?? "Value")
        numbers[key]=t;return t
    }
    func popup(_ key:Int,_ items:[String],width:CGFloat)->NSPopUpButton {
        let p=NSPopUpButton();p.addItems(withTitles:items);p.controlSize = .mini;p.font = .systemFont(ofSize:10)
        p.widthAnchor.constraint(equalToConstant:width).isActive=true
        p.setAccessibilityLabel(items[0]);menus[key]=p;return p
    }
    func checkBox(_ key:Int,_ name:String,_ checked:Bool)->NSButton {
        let b=NSButton(checkboxWithTitle:name,target:nil,action:nil);b.state=checked ? .on:.off;b.font = .systemFont(ofSize:10);toggles[key]=b;return b
    }
    var presets: [String: [String: Any]] {
        get {defaults.dictionary(forKey:"formatPresets") as? [String:[String:Any]] ?? [:]}
        set {defaults.set(newValue,forKey:"formatPresets")}
    }
    func refreshPresets() {
        let selected=presetMenu.titleOfSelectedItem
        presetMenu.removeAllItems()
        presetMenu.addItems(withTitles:presets.keys.sorted())
        if let selected {presetMenu.selectItem(withTitle:selected)}
    }
    @objc func savePreset() {
        let name=String(presetName.stringValue.trimmingCharacters(in:.whitespacesAndNewlines).prefix(60))
        guard !name.isEmpty else {status.stringValue="Name this format first.";return}
        var saved=presets
        guard saved.count<30 || saved[name] != nil else {status.stringValue="Up to 30 saved formats.";return}
        var values:[String:Any] = ["font":textFields[1]?.stringValue ?? "Arial"]
        for key in [10,11,12,13,14,15,110,111,112] {
            let number=value(key)
            guard number.isFinite else {status.stringValue="Enter valid numeric format values.";return}
            values[String(key)]=number
        }
        saved[name]=values;presets=saved;refreshPresets();presetMenu.selectItem(withTitle:name)
        status.stringValue="Saved \(name)."
    }
    @objc func loadPreset() {
        guard let name=presetMenu.titleOfSelectedItem,let values=presets[name] else{return}
        for key in [10,11,12,13,14,15,110,111,112] {if let n=values[String(key)] as? Double,n.isFinite {set(key,n)}}
        textFields[1]?.stringValue=values["font"] as? String ?? "Arial"
        presetName.stringValue=name;status.stringValue="Loaded \(name). Click Apply to use it."
    }
    @objc func removePreset() {
        guard let name=presetMenu.titleOfSelectedItem else{return}
        var saved=presets;saved.removeValue(forKey:name);presets=saved;refreshPresets()
        status.stringValue="Removed \(name). Current format values are kept."
    }
    func button(_ id:Int,_ symbol:String,_ title:String)->NSButton {
        let b=NSButton();b.tag=id;b.target=self;b.action = #selector(command(_:));b.bezelStyle = .recessed
        b.isBordered=false;b.imagePosition = .imageOnly;b.toolTip=title;b.setAccessibilityLabel(title)
        b.image=NSImage(systemSymbolName:symbol,accessibilityDescription:title) ?? NSImage(systemSymbolName:"square",accessibilityDescription:title)
        b.symbolConfiguration=NSImage.SymbolConfiguration(pointSize:13,weight:.regular)
        b.contentTintColor = .labelColor
        b.widthAnchor.constraint(equalToConstant:25).isActive=true;b.heightAnchor.constraint(equalToConstant:24).isActive=true
        buttons.append(b);return b
    }
    @objc func toggleOptions(_ sender:NSButton) {
        options.isHidden.toggle()
        sender.title=options.isHidden ? "Values & options" : "Hide options"
    }
    @objc func command(_ sender:NSButton) {
        guard !inCommand,let callback else {status.stringValue="Reopen the palette from the ribbon.";return}
        guard NSApp.modalWindow == nil else {return}
        panel.makeFirstResponder(nil)
        // Never choose a document by window order: that can switch presentations.
        // Ordinary button clicks keep PowerPoint's keyboard focus. After editing a
        // value, return focus only to the host's existing main window.
        if panel.isKeyWindow, let document=NSApp.mainWindow, document !== panel,
           document.attachedSheet == nil {document.makeKey()}
        for (k,t) in numbers { if let n=Double(t.stringValue),n.isFinite {defaults.set(n,forKey:"n\(k)")} }
        defaults.set(textFields[1]?.stringValue,forKey:"font")
        inCommand=true
        buttons.forEach{$0.isEnabled=false}
        defer {inCommand=false;buttons.forEach{$0.isEnabled=true}}
        let result=callback(Int32(sender.tag))
        if result < 0 && status.stringValue.isEmpty {status.stringValue="PowerPoint could not complete the command."}
    }
    func value(_ key:Int)->Double {
        if let field=numbers[key] {return Double(field.stringValue) ?? .nan}
        if let toggle=toggles[key] {return toggle.state == .on ? 1:0}
        if let menu=menus[key] {return Double(menu.indexOfSelectedItem)}
        if let well=colors[key-100],let c=well.color.usingColorSpace(.sRGB) {
            // VBA RGB packs red into the least significant byte.
            return Double(Int((c.redComponent*255).rounded()) | (Int((c.greenComponent*255).rounded())<<8) | (Int((c.blueComponent*255).rounded())<<16))
        }
        return .nan
    }
    func set(_ key:Int,_ value:Double) {
        if let field=numbers[key] {field.stringValue=String(format:"%g",value)}
        if let toggle=toggles[key] {toggle.state = value == 0 ? .off:.on}
        if let menu=menus[key] {menu.selectItem(at:Int(value))}
        if let well=colors[key-100] {let v=Int(value);well.color=NSColor(srgbRed:CGFloat(v&255)/255,green:CGFloat((v>>8)&255)/255,blue:CGFloat((v>>16)&255)/255,alpha:1)}
    }
    func windowWillClose(_ notification:Notification) {
        panel.endEditing(for:nil)
        hide()
    }
}

@_cdecl("FEShow") public func feShow(_ pointer:UnsafeMutableRawPointer?) {
    guard Thread.isMainThread,let pointer else{return}
    callback=unsafeBitCast(pointer,to:FECallback.self)
    if controller == nil {controller=PaletteController()}
    controller?.show()
}
@_cdecl("FEHide") public func feHide() {controller?.hide();callback=nil}
@_cdecl("FEValue") public func feValue(_ key:Int32)->Double {controller?.value(Int(key)) ?? .nan}
@_cdecl("FESetValue") public func feSetValue(_ key:Int32,_ value:Double) {guard value.isFinite else{return};controller?.set(Int(key),value)}
@_cdecl("FEStatus") public func feStatus(_ pointer:UnsafePointer<UInt16>?,_ count:Int32) {
    guard let pointer,count>=0,count<4096 else{return}
    controller?.status.stringValue=String(decoding:UnsafeBufferPointer(start:pointer,count:Int(count)),as:UTF16.self)
    controller?.status.toolTip=controller?.status.stringValue
}
@_cdecl("FECopyText") public func feCopyText(_ key:Int32,_ buffer:UnsafeMutablePointer<UInt16>?,_ capacity:Int32)->Int32 {
    guard let buffer,capacity>0,capacity<=4096 else{return 0}
    let units=Array((controller?.textFields[Int(key)]?.stringValue ?? "").utf16.prefix(Int(capacity)-1))
    for (i,c) in units.enumerated(){buffer[i]=c};buffer[units.count]=0;return Int32(units.count)
}
@_cdecl("FESetText") public func feSetText(_ key:Int32,_ pointer:UnsafePointer<UInt16>?,_ count:Int32) {
    guard let pointer,count>=0,count<4096 else{return}
    controller?.textFields[Int(key)]?.stringValue=String(decoding:UnsafeBufferPointer(start:pointer,count:Int(count)),as:UTF16.self)
}
