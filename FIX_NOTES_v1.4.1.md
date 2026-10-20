# BGS v1.4.1 – focused usability patch

- Headteacher Subjects: add and remove individual subject rows using an Add subject button, with duplicate validation.
- Notifications: search any student, select a specific recipient and retain that student's admission number in the saved local notification draft. No SMS is transmitted.
- Teachers Connection: explains the existing persistent one-time connection settings. Reconnect already retries every eight seconds while the teacher app is running. Static IP or stable hostname is required for Ethernet direct connections.
- Admissions: increased form interaction/focus stability in the shared modal stylesheet. The original reported failure to type has not been reproduced in an Electron graphical runtime; test the first/surname and parent fields before production rollout.
- Icons: previous included assets and icon mapping retained.
- No cloud migration required. Back up existing school data before installing.
