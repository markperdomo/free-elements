VERSION 1.0 CLASS
BEGIN
  MultiUse = -1
END
Attribute VB_Name = "FEEvents"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = False
Attribute VB_Exposed = False
Option Explicit
Public WithEvents Host As Application
Attribute Host.VB_VarHelpID = -1

Private Sub Host_WindowSelectionChange(ByVal Sel As Selection)
    FERefresh
End Sub

Private Sub Host_PresentationClose(ByVal Pres As Presentation)
    ' A development project's VBA code can disappear when its deck closes.
    ' Drop the native callback before any such project can be unloaded.
    FreeElementsHide
End Sub
