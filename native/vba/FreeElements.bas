Attribute VB_Name = "FreeElements"
Option Explicit

' Original Free Elements implementation. Numeric command IDs form the native ABI.
Private Declare PtrSafe Sub FEShow Lib "__NATIVE_LIBRARY__" (ByVal callback As LongPtr)
Private Declare PtrSafe Sub FEHide Lib "__NATIVE_LIBRARY__" ()
Private Declare PtrSafe Function FEValue Lib "__NATIVE_LIBRARY__" (ByVal key As Long) As Double
Private Declare PtrSafe Sub FESetValue Lib "__NATIVE_LIBRARY__" (ByVal key As Long, ByVal value As Double)
Private Declare PtrSafe Sub FEStatus Lib "__NATIVE_LIBRARY__" (ByVal text As LongPtr, ByVal length As Long)
Private Declare PtrSafe Function FECopyText Lib "__NATIVE_LIBRARY__" (ByVal key As Long, ByVal buffer As LongPtr, ByVal capacity As Long) As Long
Private Declare PtrSafe Sub FESetText Lib "__NATIVE_LIBRARY__" (ByVal key As Long, ByVal text As LongPtr, ByVal length As Long)

Private mBusy As Boolean
Private mReference As Shape
Private mReferenceSlide As Slide
Private mReferenceDeck As Presentation
Private mEvents As FEEvents
Private mLastError As String
Private mPaletteOpen As Boolean

Public Sub Auto_Open()
    Set mEvents = New FEEvents
    Set mEvents.Host = Application
    ' Load the palette only when the user opens it from the ribbon.
End Sub

Public Sub Auto_Close()
    On Error Resume Next
    FreeElementsHide
    Set mEvents = Nothing
    Set mReference = Nothing
    Set mReferenceSlide = Nothing
    Set mReferenceDeck = Nothing
End Sub

Public Sub FreeElementsShow()
    On Error GoTo Failed
    FEShow AddressOf FECommand
    mPaletteOpen = True
    If mEvents Is Nothing Then
        Set mEvents = New FEEvents
        Set mEvents.Host = Application
    End If
    FERefresh
    Exit Sub
Failed:
    mPaletteOpen = False
    MsgBox "Free Elements could not load its native palette: " & Err.Description, vbExclamation, "Free Elements"
End Sub

Public Sub FreeElementsHide()
    On Error Resume Next
    If mPaletteOpen Then FEHide
    mPaletteOpen = False
End Sub

Public Sub FreeElementsRibbon(ByVal control As IRibbonControl)
    FreeElementsShow
End Sub

Public Sub FERefresh()
    If mBusy Or Not mPaletteOpen Then Exit Sub
    On Error GoTo EmptySelection
    Dim n As Long
    n = ActiveWindow.Selection.ShapeRange.Count
    Tell CStr(n) & " selected."
    Exit Sub
EmptySelection:
    On Error Resume Next
    Tell "Select shapes on a slide."
End Sub

' Mac PowerPoint omits StartNewUndoEntry from its VBA type library.
' Call it only where available; verify the host's actual Undo behavior separately.
Private Sub BeginUndo()
    On Error Resume Next
    CallByName Application, "StartNewUndoEntry", VbMethod
    On Error GoTo 0
End Sub

Private Sub Tell(ByVal message As String)
    FEStatus StrPtr(message), Len(message)
End Sub

Private Sub Fail(ByVal message As String)
    Err.Raise vbObjectError + 710, "Free Elements", message
End Sub

Private Function ReadNumber(ByVal key As Long, ByVal low As Double, ByVal high As Double, ByVal title As String) As Double
    Dim value As Double
    value = FEValue(key)
    If Not (value >= low And value <= high) Then Fail title & " must be between " & low & " and " & high & "."
    ReadNumber = value
End Function

Private Function ReadText(ByVal key As Long) As String
    Dim buffer As String, length As Long
    buffer = String$(256, vbNullChar)
    length = FECopyText(key, StrPtr(buffer), 256)
    ReadText = Left$(buffer, length)
End Function

Private Function MinD(ByVal a As Double, ByVal b As Double) As Double
    If a < b Then MinD = a Else MinD = b
End Function
Private Function MaxD(ByVal a As Double, ByVal b As Double) As Double
    If a > b Then MaxD = a Else MaxD = b
End Function

' Re-read selection at every click; no cached shape list can edit another slide.
Private Function SelectedShapes() As ShapeRange
    If Presentations.Count = 0 Then Fail "Open a presentation first."
    If ActiveWindow Is Nothing Then Fail "Open a slide in Normal view."
    If ActiveWindow.ViewType <> ppViewNormal And ActiveWindow.ViewType <> ppViewSlide Then Fail "Switch to Normal view."
    If ActiveWindow.Selection.Type <> ppSelectionShapes And ActiveWindow.Selection.Type <> ppSelectionText Then Fail "Select shapes on a slide."
    Set SelectedShapes = ActiveWindow.Selection.ShapeRange
    Dim s As Shape
    For Each s In SelectedShapes
        If s.Type <> msoAutoShape And s.Type <> msoTextBox And s.Type <> msoPlaceholder Then Fail "Select AutoShapes, text boxes, or text placeholders."
        If s.Width <= 0 Or s.Height <= 0 Then Fail "Shapes must have positive width and height."
        If Abs(s.Rotation) > 0.001 Then Fail "These tools currently require unrotated shapes."
    Next s
End Function

Private Function ReferenceShape(ByVal shapes As ShapeRange) As Shape
    Dim mode As Long, s As Shape, found As Boolean
    mode = CLng(FEValue(1))
    If mode = 2 Then
        If mReference Is Nothing Then Fail "Select one shape and click Pin first."
        If Not mReferenceDeck Is ActivePresentation Then Fail "The pinned reference is in another presentation."
        If Not mReferenceSlide Is ActiveWindow.View.Slide Then Fail "The pinned reference is on another slide."
        For Each s In shapes
            If s.Id = mReference.Id Then found = True
        Next s
        If Not found Then Fail "Include the pinned reference in your selection."
        Set ReferenceShape = mReference
    ElseIf mode = 1 Then
        Set ReferenceShape = shapes(shapes.Count)
    Else
        Set ReferenceShape = shapes(1)
    End If
End Function

Public Function FECommand(ByVal command As Long) As Long
    If mBusy Then FECommand = -1: Exit Function
    mBusy = True
    mLastError = ""
    On Error GoTo Failed
    If command = 0 Then
        mBusy = False
        FERefresh
        Exit Function
    End If
    Dim shapes As ShapeRange, reference As Shape
    Set shapes = SelectedShapes()
    If command = 90 Then
        If shapes.Count <> 1 Then Fail "Select exactly one shape to pin."
        Set mReference = shapes(1)
        Set mReferenceDeck = ActivePresentation
        Set mReferenceSlide = ActiveWindow.View.Slide
        FESetValue 1, 2
        Tell "Pinned " & mReference.Name & ". Include it in the selection."
    Else
        Set reference = shapes(1)
        If command = 501 Or (command >= 301 And command <= 403) Then Set reference = ReferenceShape(shapes)
        If command >= 101 And command <= 106 Then
            If FEValue(2) = 0 Then Set reference = ReferenceShape(shapes)
        End If
        Select Case command
            Case 101 To 106, 201 To 206, 301 To 303: LayoutCommand shapes, reference, command
            Case 401 To 405: ShapeCommand shapes, reference, command
            Case 501: CaptureFormat reference
            Case 502: FormatCommand shapes
            Case 601 To 617: TextCommand shapes, command
            Case Else: Fail "Unknown command."
        End Select
        If command <> 501 Then Tell "Done - " & shapes.Count & " selected. Undo with Cmd+Z on the slide."
        If command = 604 Or command = 605 Then Tell "Editable copies created. Originals kept."
    End If
    FECommand = shapes.Count
Done:
    mBusy = False
    Exit Function
Failed:
    mLastError = Err.Description
    Tell mLastError
    FECommand = -1
    Resume Done
End Function

Private Sub RequireCount(ByVal shapes As ShapeRange, ByVal n As Long)
    If shapes.Count < n Then Fail "Select at least " & n & " shapes."
End Sub

Private Sub SortedIndices(ByVal shapes As ShapeRange, ByRef order() As Long, ByVal vertical As Boolean)
    Dim i As Long, j As Long, temp As Long, a As Shape, b As Shape, after As Boolean
    ReDim order(1 To shapes.Count)
    For i = 1 To shapes.Count: order(i) = i: Next i
    For i = 2 To shapes.Count
        j = i
        Do While j > 1
            Set a = shapes(order(j - 1)): Set b = shapes(order(j))
            If vertical Then
                after = a.Top > b.Top Or (a.Top = b.Top And a.Left > b.Left)
            Else
                after = a.Left > b.Left Or (a.Left = b.Left And a.Top > b.Top)
            End If
            If Not after Then Exit Do
            temp = order(j): order(j) = order(j - 1): order(j - 1) = temp
            j = j - 1
        Loop
    Next i
End Sub

Private Sub LayoutCommand(ByVal shapes As ShapeRange, ByVal reference As Shape, ByVal command As Long)
    Dim n As Long, i As Long, s As Shape, order() As Long, p As Long
    Dim x() As Double, y() As Double, w() As Double, h() As Double
    Dim locks() As Long, oldX() As Double, oldY() As Double, oldW() As Double, oldH() As Double
    Dim l As Double, t As Double, r As Double, b As Double, gap As Double, occupied As Double, cursor As Double
    Dim fraction As Double, target As Double, mode As Long, cols As Long, maxW As Double, maxH As Double
    RequireCount shapes, 2
    n = shapes.Count
    ReDim x(1 To n): ReDim y(1 To n): ReDim w(1 To n): ReDim h(1 To n)
    ReDim oldX(1 To n): ReDim oldY(1 To n): ReDim oldW(1 To n): ReDim oldH(1 To n): ReDim locks(1 To n)
    l = shapes(1).Left: t = shapes(1).Top: r = l: b = t
    For i = 1 To n
        Set s = shapes(i)
        x(i) = s.Left: y(i) = s.Top: w(i) = s.Width: h(i) = s.Height
        oldX(i) = x(i): oldY(i) = y(i): oldW(i) = w(i): oldH(i) = h(i): locks(i) = s.LockAspectRatio
        l = MinD(l, x(i)): t = MinD(t, y(i)): r = MaxD(r, x(i) + w(i)): b = MaxD(b, y(i) + h(i))
        maxW = MaxD(maxW, w(i)): maxH = MaxD(maxH, h(i))
    Next i
    Select Case command
    Case 101 To 106
        mode = CLng(FEValue(2))
        If mode = 0 Then
            l = reference.Left: t = reference.Top: r = l + reference.Width: b = t + reference.Height
        ElseIf mode = 2 Then
            l = 0: t = 0: r = ActivePresentation.PageSetup.SlideWidth: b = ActivePresentation.PageSetup.SlideHeight
        End If
        fraction = ((command - 101) Mod 3) / 2
        If command <= 103 Then
            target = l + (r - l) * fraction
            For i = 1 To n: x(i) = target - w(i) * fraction: Next i
        Else
            target = t + (b - t) * fraction
            For i = 1 To n: y(i) = target - h(i) * fraction: Next i
        End If
    Case 201 To 204
        SortedIndices shapes, order, command = 202 Or command = 204
        If command <= 202 Then
            RequireCount shapes, 3
            For i = 1 To n
                If command = 201 Then occupied = occupied + w(i) Else occupied = occupied + h(i)
            Next i
            If command = 201 Then
                gap = (x(order(n)) + w(order(n)) - x(order(1)) - occupied) / (n - 1)
            Else
                gap = (y(order(n)) + h(order(n)) - y(order(1)) - occupied) / (n - 1)
            End If
            If gap < -0.0001 Then Fail "Not enough room for equal gaps. Use fixed spacing."
            gap = MaxD(0, gap)
        Else
            gap = ReadNumber(3, 0, 10000, "Gap")
        End If
        If command = 201 Or command = 203 Then cursor = x(order(1)) Else cursor = y(order(1))
        For i = 1 To n
            p = order(i)
            If command = 201 Or command = 203 Then
                x(p) = cursor: cursor = cursor + w(p) + gap
            Else
                y(p) = cursor: cursor = cursor + h(p) + gap
            End If
        Next i
        If command = 201 Then x(order(n)) = oldX(order(n))
        If command = 202 Then y(order(n)) = oldY(order(n))
    Case 205
        gap = ReadNumber(3, 0, 10000, "Gap")
        target = ReadNumber(4, 1, n, "Columns")
        If target <> Fix(target) Then Fail "Columns must be a whole number."
        cols = CLng(target)
        SortedIndices shapes, order, True
        For i = 1 To n
            p = order(i): x(p) = l + ((i - 1) Mod cols) * (maxW + gap): y(p) = t + ((i - 1) \ cols) * (maxH + gap)
        Next i
    Case 206
        If n <> 2 Then Fail "Select exactly two shapes to swap."
        x(1) = oldX(2) + (w(2) - w(1)) / 2: y(1) = oldY(2) + (h(2) - h(1)) / 2
        x(2) = oldX(1) + (w(1) - w(2)) / 2: y(2) = oldY(1) + (h(1) - h(2)) / 2
    Case 301 To 303
        For i = 1 To n
            If command <> 302 Then w(i) = reference.Width
            If command <> 301 Then h(i) = reference.Height
            If FEValue(5) = 0 Then
                x(i) = x(i) + (oldW(i) - w(i)) / 2: y(i) = y(i) + (oldH(i) - h(i)) / 2
            End If
        Next i
    End Select
    BeginUndo
    On Error GoTo Rollback
    For i = 1 To n
        Set s = shapes(i)
        If command >= 301 Then s.LockAspectRatio = msoFalse: s.Width = w(i): s.Height = h(i): s.LockAspectRatio = locks(i)
        s.Left = x(i): s.Top = y(i)
    Next i
    Exit Sub
Rollback:
    Dim message As String
    message = Err.Description
    On Error Resume Next
    For i = 1 To n
        With shapes(i)
            .LockAspectRatio = msoFalse: .Width = oldW(i): .Height = oldH(i): .Left = oldX(i): .Top = oldY(i): .LockAspectRatio = locks(i)
        End With
    Next i
    On Error GoTo 0
    Fail message
End Sub

Private Sub ShapeCommand(ByVal shapes As ShapeRange, ByVal reference As Shape, ByVal command As Long)
    Dim s As Shape, kind As Long, i As Long, j As Long, index As Long, order() As Long, anchor As Long
    Dim radius As Double, head As Double, shaft As Double, slope As Double, depth As Double, gap As Double
    Dim refX As Double, refY As Double, refW As Double, refH As Double, refAdjustment As Double, stepX As Double, aspectLock As Long
    kind = reference.AutoShapeType
    If kind <> msoShapeChevron And kind <> msoShapeRightArrow And kind <> msoShapeRoundedRectangle Then Fail "Use chevrons, right arrows, or rounded rectangles."
    For Each s In shapes
        If s.Type <> msoAutoShape Or s.AutoShapeType <> kind Then Fail "Select shapes of the same supported type."
    Next s
    If command <= 403 Then RequireCount shapes, 2
    If command = 405 Then
        If kind <> msoShapeRoundedRectangle Then Fail "Select rounded rectangles."
        radius = ReadNumber(20, 0, 10000, "Radius")
        For Each s In shapes
            If radius > MinD(s.Width, s.Height) / 2 Then Fail "Radius exceeds half the shortest side."
        Next s
    ElseIf command = 404 Then
        If kind <> msoShapeRightArrow Then Fail "Select right arrows."
        head = ReadNumber(21, 0.1, 10000, "Arrowhead depth")
        shaft = ReadNumber(22, 1, 99, "Shaft percentage") / 100
        For Each s In shapes
            If head >= s.Width Then Fail "Arrowhead must be shallower than every arrow's width."
        Next s
    ElseIf command = 401 Then
        If kind = msoShapeRoundedRectangle Then Fail "Select chevrons or right arrows."
        index = 1: If kind = msoShapeRightArrow Then index = 2
        slope = reference.Adjustments(index) * MinD(reference.Width, reference.Height) / reference.Height
        For Each s In shapes
            If slope * s.Height >= s.Width Or slope < 0 Then Fail "The reference angle does not fit one of the shapes."
        Next s
    ElseIf command = 402 Then
        If kind <> msoShapeChevron Then Fail "Process chains use right-facing chevrons."
        gap = ReadNumber(3, 0, 10000, "Gap")
        refX = reference.Left: refY = reference.Top: refW = reference.Width: refH = reference.Height: refAdjustment = reference.Adjustments(1)
        depth = refAdjustment * MinD(refW, refH)
        If depth < 0 Or depth >= refW Then Fail "The reference chevron's point is too deep."
        stepX = refW - depth + gap
        SortedIndices shapes, order, False
        For i = 1 To shapes.Count
            If shapes(order(i)).Id = reference.Id Then anchor = i
        Next i
    End If
    BeginUndo
    For i = 1 To shapes.Count
        Set s = shapes(i)
        Select Case command
        Case 401: s.Adjustments(index) = slope * s.Height / MinD(s.Width, s.Height)
        Case 402
            Set s = shapes(order(i))
            aspectLock = s.LockAspectRatio: s.LockAspectRatio = msoFalse
            s.Width = refW: s.Height = refH: s.LockAspectRatio = aspectLock
            s.Left = refX + (i - anchor) * stepX: s.Top = refY: s.Adjustments(1) = refAdjustment
        Case 403
            For j = 1 To reference.Adjustments.Count: s.Adjustments(j) = reference.Adjustments(j): Next j
        Case 404: s.Adjustments(1) = shaft: s.Adjustments(2) = head / MinD(s.Width, s.Height)
        Case 405: s.Adjustments(1) = radius / MinD(s.Width, s.Height)
        End Select
    Next i
End Sub

Private Sub CaptureFormat(ByVal reference As Shape)
    Dim fontName As String
    If reference.Fill.Visible <> msoTrue Then Fail "Capture currently requires a visible solid fill."
    If reference.Fill.Visible Then
        If reference.Fill.Type <> msoFillSolid Or reference.Fill.Transparency <> 0 Then Fail "Capture supports opaque solid fills."
    End If
    If reference.HasTextFrame <> msoTrue Then Fail "The reference needs a text frame."
    If reference.TextFrame.TextRange.Font.Size <= 0 Then Fail "The reference has mixed font sizes."
    If reference.TextFrame.TextRange.Font.Name = "" Or reference.TextFrame.TextRange.Font.Bold = msoTriStateMixed Then Fail "The reference has mixed font formatting."
    FESetValue 110, reference.Fill.ForeColor.RGB
    FESetValue 111, reference.Line.ForeColor.RGB
    If reference.Line.Visible Then FESetValue 13, reference.Line.Weight Else FESetValue 13, 0
    FESetValue 112, reference.TextFrame.TextRange.Font.Color.RGB
    FESetValue 14, reference.TextFrame.TextRange.Font.Size
    FESetValue 15, Abs(reference.TextFrame.TextRange.Font.Bold = msoTrue)
    fontName = reference.TextFrame.TextRange.Font.Name
    FESetText 1, StrPtr(fontName), Len(fontName)
    Tell "Captured reference fill, outline, and font."
End Sub

Private Sub FormatCommand(ByVal shapes As ShapeRange)
    Dim s As Shape, fontName As String, size As Double, weight As Double
    Dim fillOn As Boolean, lineOn As Boolean, textOn As Boolean
    fillOn = FEValue(10) = 1: lineOn = FEValue(11) = 1: textOn = FEValue(12) = 1
    If Not (fillOn Or lineOn Or textOn) Then Fail "Check at least one format property."
    If textOn Then
        fontName = Trim$(ReadText(1)): If Len(fontName) = 0 Then Fail "Enter a font family."
        size = ReadNumber(14, 1, 4000, "Font size")
        For Each s In shapes
            If s.HasTextFrame <> msoTrue Then Fail "Every selected shape needs a text frame."
        Next s
    End If
    If lineOn Then weight = ReadNumber(13, 0, 100, "Outline width")
    BeginUndo
    For Each s In shapes
        If fillOn Then s.Fill.Visible = msoTrue: s.Fill.Solid: s.Fill.ForeColor.RGB = CLng(FEValue(110)): s.Fill.Transparency = 0
        If lineOn Then
            If weight = 0 Then
                s.Line.Visible = msoFalse
            Else
                s.Line.Visible = msoTrue: s.Line.ForeColor.RGB = CLng(FEValue(111)): s.Line.Transparency = 0: s.Line.DashStyle = msoLineSolid: s.Line.Weight = weight
            End If
        End If
        If textOn Then
            With s.TextFrame.TextRange.Font
                .Name = fontName: .Size = size: .Color.RGB = CLng(FEValue(112))
                If FEValue(15) = 1 Then .Bold = msoTrue Else .Bold = msoFalse
            End With
        End If
    Next s
End Sub

Private Sub TextCommand(ByVal shapes As ShapeRange, ByVal command As Long)
    Dim s As Shape, tr As TextRange, para As TextRange, i As Long, allWrapped As Boolean
    Dim margins(0 To 3) As Double, delta As Long, level As Long
    allWrapped = True
    For Each s In shapes
        If s.HasTextFrame <> msoTrue Then Fail "Every selected shape needs a text frame."
        If s.TextFrame.WordWrap <> msoTrue Then allWrapped = False
    Next s
    If command = 604 Or command = 605 Then TextCopies shapes, command: Exit Sub
    If command = 612 Then
        For i = 0 To 3: margins(i) = ReadNumber(30 + i, 0, 1000, "Text margin"): Next i
    End If
    BeginUndo
    For Each s In shapes
        Select Case command
        Case 601: s.TextFrame2.AutoSize = msoAutoSizeShapeToFitText
        Case 602: s.TextFrame2.AutoSize = msoAutoSizeTextToFitShape
        Case 603
            If allWrapped Then s.TextFrame.WordWrap = msoFalse Else s.TextFrame.WordWrap = msoTrue
        Case 606: s.TextFrame2.AutoSize = msoAutoSizeNone
        Case 607, 608, 609
            With s.TextFrame.TextRange.ParagraphFormat.Bullet
                If command = 609 Then
                    .Visible = msoFalse
                Else
                    .Visible = msoTrue
                    If command = 608 Then
                        .Type = ppBulletNumbered: .Style = ppBulletArabicPeriod: .StartValue = 1
                    Else
                        .Type = ppBulletUnnumbered: .Character = 8226
                    End If
                End If
            End With
        Case 610, 611
            delta = 1: If command = 610 Then delta = -1
            For i = 1 To s.TextFrame.TextRange.Paragraphs.Count
                Set para = s.TextFrame.TextRange.Paragraphs(i)
                level = para.IndentLevel
                para.IndentLevel = MaxD(1, MinD(5, level + delta))
            Next i
        Case 612
            With s.TextFrame
                .MarginLeft = margins(0): .MarginRight = margins(1): .MarginTop = margins(2): .MarginBottom = margins(3)
            End With
        Case 613, 614
            delta = 1: If command = 613 Then delta = -1
            With s.TextFrame
                .MarginLeft = MaxD(0, .MarginLeft + delta): .MarginRight = MaxD(0, .MarginRight + delta)
                .MarginTop = MaxD(0, .MarginTop + delta): .MarginBottom = MaxD(0, .MarginBottom + delta)
            End With
        Case 615: s.TextFrame.TextRange.ParagraphFormat.Alignment = ppAlignLeft
        Case 616: s.TextFrame.TextRange.ParagraphFormat.Alignment = ppAlignCenter
        Case 617: s.TextFrame.TextRange.ParagraphFormat.Alignment = ppAlignRight
        End Select
    Next s
End Sub

Private Sub TextCopies(ByVal shapes As ShapeRange, ByVal command As Long)
    Dim texts As Variant, merged As String, i As Long, order() As Long, s As Shape, newShape As Shape
    Dim x As Double, y As Double, width As Double, rightEdge As Double, fontSize As Double, gap As Double, fontName As String
    Dim slide As Slide, ids() As Variant, created As Collection, item As Variant, message As String
    fontName = Trim$(ReadText(1)): If Len(fontName) = 0 Then Fail "Enter a font family."
    fontSize = ReadNumber(14, 1, 4000, "Font size")
    gap = ReadNumber(3, 0, 10000, "Gap")
    x = shapes(1).Left: y = shapes(1).Top: width = shapes(1).Width
    rightEdge = x + width
    For Each s In shapes
        x = MinD(x, s.Left): y = MinD(y, s.Top): rightEdge = MaxD(rightEdge, s.Left + s.Width)
    Next s
    width = rightEdge - x
    If command = 604 Then
        If shapes.Count <> 1 Then Fail "Select one text shape to split into paragraph copies."
        merged = Replace(shapes(1).TextFrame.TextRange.Text, vbCrLf, vbCr)
        merged = Replace(merged, vbLf, vbCr)
        texts = Split(merged, vbCr)
        If UBound(texts) < 1 Then Fail "This shape needs at least two paragraphs."
        If UBound(texts) > 99 Then Fail "Split supports up to 100 paragraphs."
    Else
        RequireCount shapes, 2
        SortedIndices shapes, order, True
        For i = 1 To shapes.Count
            If Len(shapes(order(i)).TextFrame.TextRange.Text) > 0 Then
                If Len(merged) > 0 Then merged = merged & vbCr
                merged = merged & shapes(order(i)).TextFrame.TextRange.Text
            End If
        Next i
        texts = Array(merged)
    End If
    If Len(Trim$(Replace(merged, vbCr, ""))) = 0 Then Fail "No text to copy."
    Set slide = ActiveWindow.View.Slide
    Set created = New Collection
    ReDim ids(0 To UBound(texts))
    x = x + 12: y = y + 12
    BeginUndo
    On Error GoTo Rollback
    For i = 0 To UBound(texts)
        Set newShape = slide.Shapes.AddTextbox(msoTextOrientationHorizontal, x, y, width, fontSize * 1.5 + 8)
        created.Add newShape
        newShape.Name = "Free Elements text copy " & newShape.Id
        newShape.TextFrame.TextRange.Text = texts(i)
        With newShape.TextFrame.TextRange.Font
            .Name = fontName: .Size = fontSize: .Color.RGB = CLng(FEValue(112))
            If FEValue(15) = 1 Then .Bold = msoTrue Else .Bold = msoFalse
        End With
        newShape.Fill.Visible = msoFalse: newShape.Line.Visible = msoFalse
        newShape.TextFrame.WordWrap = msoTrue: newShape.TextFrame2.AutoSize = msoAutoSizeShapeToFitText
        ids(i) = newShape.Name
        y = y + newShape.Height + gap
    Next i
    slide.Shapes.Range(ids).Select
    Exit Sub
Rollback:
    message = Err.Description
    On Error Resume Next
    For Each item In created: item.Delete: Next item
    On Error GoTo 0
    Fail message
End Sub
