import { SetMetadata } from '@nestjs/common';

import { StudentActionKey } from './student-permission-keys';

export const REQUIRED_STUDENT_ACTION_KEY = 'requiredStudentAction';

// Gates a route behind one Students-page granular action, e.g.
// @RequireStudentAction('add'). Always pair with @RequirePage('students')
// (or RequirePage('students', 'settings') for the shared academic routes) —
// this decorator only narrows access further, it never grants page access.
export const RequireStudentAction = (action: StudentActionKey) =>
  SetMetadata(REQUIRED_STUDENT_ACTION_KEY, action);
