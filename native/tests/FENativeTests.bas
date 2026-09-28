Attribute VB_Name = "FENativeTests"
Option Explicit
Private Declare PtrSafe Sub NativeSetValue Lib "__NATIVE_LIBRARY__" Alias "FESetValue" (ByVal key As Long, ByVal value As Double)
' Creates its own disposable presentation. Does not edit the active user document.
Private passes As Long
Private failures As Long
Private report As String
Private runStamp As String

Private Sub FETestSetValue(ByVal key As Long, ByVal value As Double)
    NativeSetValue key, value
End Sub

Private Sub FETestWriteReport(ByVal text As String)
    Dim f As Integer
    f = FreeFile
    Open "__BUILD_DIR__/native-validation-" & runStamp & ".txt" For Output As #f
    Print #f, text
    Close #f
End Sub

Private Sub Check(ByVal condition As Boolean, ByVal description As String)
    If condition Then
        passes = passes + 1
    Else
        failures = failures + 1
        report = report & "FAIL: " & description & vbCrLf
    End If
End Sub

Private Sub Near(ByVal actual As Double, ByVal expected As Double, ByVal description As String)
    Check Abs(actual - expected) < 0.02, description & " actual=" & actual & " expected=" & expected
End Sub

Public Sub FERunNativeTests()
    On Error GoTo Crashed
    passes = 0: failures = 0: report = ""
    runStamp = Format$(Now, "yyyymmdd-hhnnss")
    Dim deck As Presentation, slide As Slide, a As Shape, b As Shape, c As Shape, code As Long
    Set deck = Presentations.Add
    deck.PageSetup.SlideWidth = 960: deck.PageSetup.SlideHeight = 540
    Set slide = deck.Slides.Add(1, ppLayoutBlank)
    Set a = slide.Shapes.AddShape(msoShapeRectangle, 50, 80, 120, 60)
    Set b = slide.Shapes.AddShape(msoShapeRectangle, 250, 140, 160, 80)
    Set c = slide.Shapes.AddShape(msoShapeRectangle, 550, 200, 100, 100)
    a.TextFrame.TextRange.Text = "First": b.TextFrame.TextRange.Text = "Second": c.TextFrame.TextRange.Text = "Third"
    FreeElementsShow
    ' Keep runs independent of palette settings left by earlier editing sessions.
    FETestSetValue 1, 0: FETestSetValue 2, 0: FETestSetValue 3, 24
    FETestSetValue 4, 2: FETestSetValue 5, 0
    FETestSetValue 10, 1: FETestSetValue 11, 1: FETestSetValue 12, 1
    FETestSetValue 20, 10: FETestSetValue 21, 24: FETestSetValue 22, 50
    slide.Shapes.SelectAll
    code = FECommand(104)
    Check code = 3, "alignment command succeeded"
    Near b.Top, 80, "align top"
    Near c.Top, 80, "align top third"
    code = FECommand(201)
    Near b.Left - (a.Left + a.Width), c.Left - (b.Left + b.Width), "equal edge gaps"
    code = FECommand(301)
    Near b.Width, a.Width, "match width"
    code = FECommand(205)
    Near b.Left - (a.Left + a.Width), 24, "grid gap"
    Near c.Top, 204, "grid row max height"
    a.Select
    code = FECommand(90)
    Check code = 1, "pin one shape"
    b.Select
    code = FECommand(104)
    Check code = -1, "reject absent pinned reference"
    slide.Shapes.SelectAll
    code = FECommand(303)
    Near b.Height, a.Height, "match height with pinned reference"
    ' Reset to first reference through the native test bridge.
    FETestSetValue 1, 0
    FETestSetValue 30, 10: FETestSetValue 31, 12: FETestSetValue 32, 6: FETestSetValue 33, 8
    code = FECommand(612)
    Near b.TextFrame.MarginLeft, 10, "text left margin"
    Near b.TextFrame.MarginBottom, 8, "text bottom margin"
    a.TextFrame.TextRange.Text = "One" & vbCr & "Two" & vbCr & "Three"
    a.Select
    code = FECommand(608)
    Check a.TextFrame.TextRange.ParagraphFormat.Bullet.Type = ppBulletNumbered, "numbering"
    code = FECommand(611)
    Check a.TextFrame.TextRange.Paragraphs(1).IndentLevel = 2, "indent"
    code = FECommand(610)
    Check a.TextFrame.TextRange.Paragraphs(1).IndentLevel = 1, "outdent"
    code = FECommand(604)
    Check slide.Shapes.Count = 6, "split makes 3 copies"
    Check a.TextFrame.TextRange.Text = "One" & vbCr & "Two" & vbCr & "Three", "split preserves original"
    code = FECommand(605)
    Check slide.Shapes.Count = 7, "merge creates one copy"
    Set slide = deck.Slides.Add(2, ppLayoutBlank)
    ActiveWindow.View.GotoSlide 2
    Set a = slide.Shapes.AddShape(msoShapeChevron, 50, 80, 170, 100)
    Set b = slide.Shapes.AddShape(msoShapeChevron, 320, 140, 130, 80)
    a.Adjustments(1) = 0.2
    slide.Shapes.SelectAll
    code = FECommand(402)
    Check code = 2, "chain command succeeded"
    Near b.Left, 224, "chain uses point depth and gap"
    Near b.Width, 170, "chain matches width"
    Near b.Top, 80, "chain baseline"
    Set slide = deck.Slides.Add(3, ppLayoutBlank)
    ActiveWindow.View.GotoSlide 3
    Set a = slide.Shapes.AddShape(msoShapeRightArrow, 50, 80, 200, 100)
    Set b = slide.Shapes.AddShape(msoShapeRightArrow, 350, 80, 140, 80)
    slide.Shapes.SelectAll
    code = FECommand(404)
    Near a.Adjustments(2) * 100, 24, "arrow physical depth"
    Near b.Adjustments(2) * 80, 24, "arrow depth across sizes"
    Set slide = deck.Slides.Add(4, ppLayoutBlank)
    ActiveWindow.View.GotoSlide 4
    Set a = slide.Shapes.AddShape(msoShapeRoundedRectangle, 50, 80, 200, 100)
    Set b = slide.Shapes.AddShape(msoShapeRoundedRectangle, 350, 80, 140, 80)
    slide.Shapes.SelectAll
    code = FECommand(405)
    Near a.Adjustments(1) * 100, 10, "radius in points"
    Near b.Adjustments(1) * 80, 10, "radius across sizes"
    FETestSetValue 20, 100
    code = FECommand(405)
    Check code = -1, "oversized radius rejected"
    Near a.Adjustments(1) * 100, 10, "radius rejection leaves selection unchanged"
    FETestSetValue 20, 10
    ' Capture/apply is selective and preserves text content.
    Set slide = deck.Slides.Add(5, ppLayoutBlank)
    ActiveWindow.View.GotoSlide 5
    Set a = slide.Shapes.AddShape(msoShapeRectangle, 50, 80, 200, 100)
    Set b = slide.Shapes.AddShape(msoShapeRectangle, 350, 80, 140, 80)
    a.TextFrame.TextRange.Text = "Reference": b.TextFrame.TextRange.Text = "Keep these words"
    a.Fill.ForeColor.RGB = RGB(20, 80, 120)
    a.TextFrame.TextRange.Font.Name = "Arial": a.TextFrame.TextRange.Font.Size = 24
    a.TextFrame.TextRange.Font.Bold = msoTrue
    a.Select
    code = FECommand(501)
    Check code = 1, "capture format"
    b.Select
    FETestSetValue 11, 0: FETestSetValue 12, 0
    code = FECommand(502)
    Check b.Fill.ForeColor.RGB = RGB(20, 80, 120), "apply captured fill"
    Check b.TextFrame.TextRange.Font.Size <> 24, "fill only leaves font alone"
    Check b.TextFrame.TextRange.Text = "Keep these words", "format keeps text"
    FETestSetValue 10, 0: FETestSetValue 12, 1
    code = FECommand(502)
    Near b.TextFrame.TextRange.Font.Size, 24, "apply font size"
    Check b.TextFrame.TextRange.Font.Bold = msoTrue, "apply bold"
    code = FECommand(603)
    Check b.TextFrame.WordWrap = msoFalse, "toggle wrap off"
    code = FECommand(603)
    Check b.TextFrame.WordWrap = msoTrue, "toggle wrap on"
    code = FECommand(602)
    Check b.TextFrame2.AutoSize = msoAutoSizeTextToFitShape, "shrink to fit"
    code = FECommand(606)
    Check b.TextFrame2.AutoSize = msoAutoSizeNone, "disable autofit"
    code = FECommand(601)
    Check b.TextFrame2.AutoSize = msoAutoSizeShapeToFitText, "fit shape to text"
    code = FECommand(607)
    Check b.TextFrame.TextRange.ParagraphFormat.Bullet.Type = ppBulletUnnumbered, "bullets"
    code = FECommand(609)
    Check b.TextFrame.TextRange.ParagraphFormat.Bullet.Visible = msoFalse, "plain paragraphs"
    code = FECommand(616)
    Check b.TextFrame.TextRange.ParagraphFormat.Alignment = ppAlignCenter, "paragraph alignment"
    FETestSetValue 10, 1: FETestSetValue 11, 1: FETestSetValue 12, 1
    FETestSetValue 14, 18: FETestSetValue 15, 0
    ' Matching physical angles and adjustments across right arrows.
    ActiveWindow.View.GotoSlide 3
    Set slide = deck.Slides(3)
    Set a = slide.Shapes(1): Set b = slide.Shapes(2)
    slide.Shapes.SelectAll
    code = FECommand(401)
    Near a.Adjustments(2), b.Adjustments(2), "matching right arrow slope"
    a.Adjustments(1) = 0.3
    code = FECommand(403)
    Near b.Adjustments(1), 0.3, "matching adjustment handles"
    deck.SaveAs "__BUILD_DIR__/native-validation-" & runStamp & ".pptx", ppSaveAsOpenXMLPresentation
    report = "PASS " & passes & "; FAIL " & failures & vbCrLf & report
    FETestWriteReport report
    MsgBox report, vbInformation, "Free Elements native tests"
    Exit Sub
Crashed:
    report = "ERROR " & Err.Number & ": " & Err.Description & vbCrLf & report
    FETestWriteReport report
    MsgBox report, vbExclamation, "Free Elements native tests"
End Sub
