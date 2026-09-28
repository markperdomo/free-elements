Attribute VB_Name = "FEProbe"
Option Explicit

Private Declare PtrSafe Sub FEProbeShow Lib "__PROBE_LIBRARY__" (ByVal callback As LongPtr)
Private Declare PtrSafe Sub FEProbeHide Lib "__PROBE_LIBRARY__" ()

Public Sub ShowNativeProbe()
    FEProbeShow AddressOf ProbeCallback
End Sub

Public Function ProbeCallback(ByVal command As Long) As Long
    ProbeCallback = ActivePresentation.Slides.Count
End Function

Public Sub HideNativeProbe()
    FEProbeHide
End Sub
