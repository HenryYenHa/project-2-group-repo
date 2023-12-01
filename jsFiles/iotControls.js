// API Documentation on the link below
// https://developers.home-assistant.io/docs/api/websocket
// demoMove1 key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhOGNiMTNjZTJiN2Y0ZDFjYjk0MWM1YzFjYTRmN2YyMSIsImlhdCI6MTcwMDI1MDQxNywiZXhwIjoyMDE1NjEwNDE3fQ.xc0OTLmb-UVyHwM-ts1HP36neodPU5t4UzSy0i8OJsQ
const socket = new WebSocket("ws://homeassistant.local:8123/api/websocket");
const accessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhOGNiMTNjZTJiN2Y0ZDFjYjk0MWM1YzFjYTRmN2YyMSIsImlhdCI6MTcwMDI1MDQxNywiZXhwIjoyMDE1NjEwNDE3fQ.xc0OTLmb-UVyHwM-ts1HP36neodPU5t4UzSy0i8OJsQ";
let idNumber = 1; //Initial ID number
let interactFlag = true; //Interact Flag to prevent overwrites
let isFinallyConnected = false; //Prevent requesting of read states before connection established

//Global variables to check the status of devices
let statDevice = ""; //Global Variable to seek device's information
let statStatusOfDevice = ""; //Global Variable of sought device's information
let statFlag = false; //Global Variable to check Status; prevents reading before getting information
let statID = -1; //Global Variable to check status when it is asked for

// List of input IDs
const doorBell = "camera.g8t1_sj02_3294_01vr"; //Name of Doorbell
const doorBellMotion = "blink G8T1-SJ02-3294-01VR Motion"; //Name of Doorbell Motion sensor?
const overheadLights = "switch.thing2"; //Name of Lamp; Should be Overhead lights; light 0
const floorLights = "switch.thing1"; //Name of second Lamp; should be floor lights; light 1
const accentLights = "switch.thing3"; //Name of incoming new switch light 2; light 2
const handrailLights = "tempFakeHand"; //Name of incoming new switch light 3; light 3
const washroomLights = "tempFakeWash"; //Name of incoming new switch light 4; light 4
const motionSensor = "binary_sensor.presence_sensor_fp2_1708_presence_sensor_1"; //Name of Motion Sensor
const luminSensor = "sensor.presence_sensor_fp2_1708_light_sensor_light_level"; //Name of Light sensor
const weightSensor = "sensor.smart_scale_c1_real_time_weight"; //Name of Weight sensor

// START OF SOCKET ACTIONS
// ********************************************************************************************************** //
// Upon starting up a connection we want to...
socket.onopen = async (event) => {
  console.log("WebSocket connection opened:", event);

  // ... first authenticate that it is us...
  socket.send(
    JSON.stringify({
      type: "auth",
      access_token: accessToken,
    })
  );

  // ... and subscribe to events that come out of the Home Assistant (Raspberry Pi)
  socket.send(
    JSON.stringify({
      id: idNumber,
      type: "subscribe_events",
    })
  );
  idNumber++;
  getStates();
};

// When we receive a message, we want to...
socket.onmessage = (event) => {
  //... convert the incoming JSON into a usable form and then...
  const data1 = JSON.parse(event.data);
  debug("1)Type= ", data1.type); //debug
  try {
    //...  check if it is an "event" type message...
    if (data1.type == "event") {
      // ... and if it is, then it is a 'state change'...
      if (data1.event.event_type == "state_changed") {
        // ... of a device we are familiar with...
        const deviceID = data1.event.data.entity_id;
        debug("2)EntityID: ", deviceID); //debug
        //... then we will act accordingly.
        switch (deviceID) {
          case overheadLights:
          case floorLights:
          case accentLights:
          case handrailLights:
          case washroomLights:
            readLight(data1, deviceID);
            break;
          case luminSensor:
            readLuminSensor(data1);
            break;
          case motionSensor:
            readMotionSensor(data1);
            break;
          case weightSensor:
            readWeightSensor(data1);
            break;
          case doorBell:
            readDoorbell(data1);
            break;
          case "sun.sun":
            debug("3)Sun Data"); //debug
            break;
          default:
            //... unless we actually aren't familiar with it.
            debug("3)Unlisted ID: ", deviceID); //debug
            debug("3)Payload: ", data1); //debug
        }
      } else {
        readOtherDataType(data1);
      }
      // If this is a requested status
    } else if (data1.type == "result") {
      //If it is a requested state result
      if (data1.id == statID) {
        readResults(data1);
        debug("2)Results seeking: ", statDevice); //debug
      } else {
        debug("2)Results: ", data1); //debug
      }
    }
  } catch (error) {
    console.error("Error: Uncooperative JSON ", error);
    console.log("Problem JSON: ", JSON.stringify(JSON.parse(event.data)));
  }
};

//SHOULD NOT BE NECESSARY
// //On load of window, grab states
// window.onload = function () {
//   let int = setInterval(() => {
//     //Repeat this until status of device has been read
//     if (isFinallyConnected) {
//       clearInterval(int);
//       getStates();
//     }
//   }, 1000);
// };

//Upon Closing Connection
socket.onclose = (event) => {
  console.log("WebSocket connection closed:", event);
};

//Upon Sending a message
function sendMessage(message) {
  console.log("POST: ", message); //debug
  socket.send(message);
}

//Get request for states
function getStates() {
  const message = JSON.stringify({
    id: idNumber,
    type: "get_states",
  });
  statID = idNumber;
  idNumber++;
  debug(message); //debug
  sendMessage(message);
}

//Grab status
function getStatus(deviceID) {
  statDevice = deviceID; //set global variable of device I am seeking
  getStates(); //Request data from Home Assistant
  let int = setInterval(() => {
    //Repeat this until status of device has been read
    if (statFlag) {
      clearInterval(int);
      debug("###STAT:", statStatusOfDevice); //DEbug
      statFlag = false;
      return statStatusOfDevice;
    }
  }, 1000);
}

// DEVICE FUNCTIONS
//********************************************************************************/

//Function to flick the light switch
function triggerLightSwitch(buttonID) {
  if (interactFlag) {
    interactFlag = false;
    //Check which light is the corresponding ID given
    const obj = checkWhichLight(buttonID);
    const deviceName = obj.deviceID;
    const message = JSON.stringify({
      id: idNumber,
      type: "call_service",
      domain: "switch",
      service: "toggle",
      service_data: {
        entity_id: deviceName,
      },
    });
    idNumber++;
    sendMessage(message);
    return getStatus(deviceName);
  } else {
    debug(
      "InteractionTemporarilyDisabled^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^"
    ); //debug
    return "NOPE";
  }
}

//Sub-function of triggerLightSwitch
function checkWhichLight(identifier) {
  switch (identifier) {
    case 0:
    case "Overhead Lights":
    case overheadLights:
    case "vCarouselLightID0":
      return {
        idNum: 0,
        name: "Overhead Light",
        deviceID: overheadLights,
        elem: document.getElementById("vCarouselLightID0"),
      };
    case 1:
    case "Floor Lights":
    case floorLights:
    case "vCarouselLightID1":
      return {
        idNum: 1,
        name: "Floor Lights",
        deviceID: floorLights,
        elem: document.getElementById("vCarouselLightID1"),
      };
    case 2:
    case "Accent Lights":
    case accentLights:
    case "vCarouselLightID2":
      return {
        idNum: 2,
        name: "Accent Lights",
        deviceID: accentLights,
        elem: document.getElementById("vCarouselLightID2"),
      };
    case 3:
    case "Handrail Lights":
    case handrailLights:
    case "vCarouselLightID3":
      return {
        idNum: 3,
        name: "Handrail Lights",
        deviceID: handrailLights,
        elem: document.getElementById("vCarouselLightID3"),
      };
    case 4:
    case "Washroom Lights":
    case washroomLights:
    case "vCarouselLightID4":
      return {
        idNum: 4,
        name: "Washroom Lights",
        deviceID: washroomLights,
        elem: document.getElementById("vCarouselLightID4"),
      };
    default:
      console.log("Error: input pairing unknown:", identifier);
      return "UNKNOWN LIGHT PAIRING";
  }
}

//How we deal with reading the doorbell
function readDoorbell(data1) {
  console.log("Reached Doorbell");
}

function readLight(data1, deviceID) {
  //REPLACE ALL OF THESE WITH APPROPRIATE ACTIONS!
  const newState = data1.event.data.new_state.state;
  const obj = checkWhichLight(deviceID);
  const elementID = obj.elem;
  debug("Light: ", deviceID, "; Status: ", newState); //debug
  if (newState == "on") {
    elementID.innerHTML = `<img src="../images/lightOn.png">
     <p>${obj.name}</p>
     <div class="lightOn-OffDiv smartLightON" >ON</div>`;
  } else if (newState == "off") {
    elementID.innerHTML = `<img src="../images/light.png">
     <p>${obj.name}</p>
     <div class="lightOn-OffDiv smartLightOFF">OFF</div>`;
  } else {
    console.log("Error: Unknown new light state: ", newState);
  }
}

//How we deal with reading the luminosity levels on the motion sensor
function readLuminSensor(data1) {
  //REPLACE ALL OF THIS WITH APPROPRIATE THINGS
  const fLumUp = document.getElementById("fancyTest-LightUp"); //CHANGE
  const fLumDown = document.getElementById("fancyTest-LightDown"); //CHANGE
  const newState = data1.event.data.new_state.state;
  const oldState = data1.event.data.old_state.state;
  if (newState > oldState) {
    fLumUp.style.color = "green"; //CHANGE
    fLumDown.style.color = "red"; //CHANGE
  } else if (newState <= oldState) {
    fLumUp.style.color = "red"; //CHANGE
    fLumDown.style.color = "green"; //CHANGE
  } else {
    console.log("Error: Luminosity level transition unknown");
    console.log("New state= ", newState, "; Old state = ", oldState);
  }
}

//How we deal with reading the motion sensor detecting motion
function readMotionSensor(data1) {
  // //REPLACE WITH ALL APPROPRIATE STUFF
  // const mLeft = document.getElementById("fancyTest-MotionLeft"); //CHANGE
  // const mEnter = document.getElementById("fancyTest-MotionEnter"); //CHANGE
  // const mPresence = document.getElementById("fancyTest-MotionPresence"); //CHANGE
  const newState = data1.event.data.new_state.state;
  debug("Motion: ", data1); //DEBUG
  if (newState == "on") {
    // mPresence.style.color = "green"; //CHANGE
    // mLeft.style.color = "red"; //CHANGE
  } else if (newState == "off") {
    // mPresence.style.color = "red"; //CHANGE
    // mLeft.style.color = "green"; //CHANGE
  } else {
    console.log("Error: Unknown motion detector state detected: ", newState);
  }
}

//How we deal with reading other event types and data
function readOtherDataType(data1) {
  const eventType = data1.event.event_type;
  switch (eventType) {
    case "call_service":
      debug("3)Event Type: call_service"); //debug
      break;
    case "config_entry_discovered":
      debug("3)Event Type: config_entry_discovered"); //debug
      break;
    case "recorder_5min_statistics_generated":
      debug("3)Event Type: recorder_5min_statistics_generated"); //debug
      break;
    default:
      debug("3)Unlisted event type: ", eventType); //debug
      break;
  }

  debug("3.5)Payload: ", data1); //debug
}

//How we deal with readings from the weight sensor; it detects and stores the value in KG
function readWeightSensor(data1) {
  //REPLACE ALL ITEMS IN THIS AREA WITH APPROPRIATE FUNCTIONS
  // const weightText = document.getElementById("fancyTestWeight"); //CHANGE
  const givenWeightkgs = data1.event.data.new_state.state;
  const givenWeightlbs = givenWeightkgs * 2.2;
  debug(`Weight = ${givenWeightkgs}kgs or ${givenWeightlbs}lbs`); //debug
  // weightText.innerHTML = `Weight = ${givenWeightkgs}kgs or ${givenWeightlbs}lbs`; //CHANGE
}

//Reads results according to statDevice and updates statStatusOfDevice
function readResults(data1) {
  const information = data1.result;
  statStatusOfDevice = "Error: Unable To Find Device";
  let i = 0;
  for (item in information) {
    if (information[i].entity_id == statDevice) {
      statStatusOfDevice = information[i].state;
      statFlag = true;
      setTimeout(enableInteractionFlag(), 1000);
      debug("INREAD:", statStatusOfDevice); //DEBUG
      break;
    }
    i++;
  }
}

function enableInteractionFlag() {
  interactFlag = true;
}

//Debug Code here; disable by disabling console.log
function debug(msg0, msg1, msg2, msg3, msg4, msg5) {
  if (msg0 == undefined) msg0 = "";
  if (msg1 == undefined) msg1 = "";
  if (msg2 == undefined) msg2 = "";
  if (msg3 == undefined) msg3 = "";
  if (msg4 == undefined) msg4 = "";
  if (msg5 == undefined) msg5 = "";
  console.log(msg0, msg1, msg2, msg3, msg4, msg5);
}

debug("IoT controls loaded"); //debug
