// Default settings – shared by the content script and the settings page.
var HoldToScrollDefaults = {
  dragKey: "ShiftLeft",      // KeyboardEvent.code, "" = not set (Shift/Ctrl/Super: either side)
  dragKeyName: "Shift",      // KeyboardEvent.key at recording time, for a layout-correct label
  scrollKey: "AltLeft",
  scrollKeyName: "Alt",
  overlayStyle: "invert",    // overlay colors: "invert" | "dark" | "light"
  momentum: true,            // momentum & coasting
  brakeTime: 250,            // coast time (ms)
  invert: false,             // drag mode: reverse direction
  speed: 1,                  // drag mode: factor
  showFrame: true,           // drag mode: show frame
  showIndicator: true,       // scroll mode: show anchor and speed
  scrollMode: "progressive", // scroll mode: "progressive" | "steps"
  deadZone: 15,              // scroll mode: radius without movement (px)
  scrollSpeed: 400,          // progressive: px/s at 100 px beyond the dead zone
  scrollCurve: 1.5,          // progressive: acceleration (exponent, 1 = linear)
  scrollMax: 6000,           // progressive: top speed (px/s)
  ringWidth: 60,             // steps: width per zone (px)
  zoneSpeeds: [150, 400, 1000, 2500], // steps: px/s per zone, inside out
  disabledSites: [],         // hostnames where the add-on is off
};
