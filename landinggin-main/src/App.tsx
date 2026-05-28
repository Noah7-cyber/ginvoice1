/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import WelcomeScreen from './WelcomeScreen';

export default function App() {
  return (
    <WelcomeScreen 
      onRegister={() => console.log('Register clicked')}
      onLogin={() => console.log('Login clicked')}
    />
  );
}
