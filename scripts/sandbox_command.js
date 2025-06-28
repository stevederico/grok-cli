/**
 * @license
 * 
 * SPDX-License-Identifier: Apache-2.0
 */

//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Stub for sandbox_command.js - sandboxing disabled
const args = process.argv.slice(2);

if (args.includes('-q')) {
  // Quiet mode - exit with error to indicate sandboxing is disabled
  process.exit(1);
} else {
  // Return docker command for compatibility
  console.log('docker');
}