export var VitalType;
(function (VitalType) {
    VitalType["CPU"] = "cpu";
    VitalType["RAM"] = "ram";
    VitalType["STORAGE"] = "storage";
    VitalType["TEMP"] = "temp";
    VitalType["GPU"] = "gpu";
})(VitalType || (VitalType = {}));
// Bar orientation options
export var Orientation;
(function (Orientation) {
    Orientation["HORIZONTAL"] = "horizontal";
    Orientation["VERTICAL"] = "vertical";
})(Orientation || (Orientation = {}));
// Helper to get vital display name

export function getVitalDisplayName(type) {
    const names = {
        [VitalType.CPU]: 'CPU',
        [VitalType.RAM]: 'RAM',
        [VitalType.STORAGE]: 'Storage',
        [VitalType.TEMP]: 'Temperature',
        [VitalType.GPU]: 'GPU',
    };
    return names[type];
}
