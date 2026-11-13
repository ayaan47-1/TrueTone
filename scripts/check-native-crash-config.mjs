import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function checkNativeCrashConfig({appDelegate,infoPlist}) {
  const errors=[];
  if (/\b(?:Sentry|RNSentry)\w*/i.test(appDelegate)) errors.push('Generated iOS AppDelegate must not import or start native Sentry');
  if (/sentry/i.test(infoPlist)) errors.push('Generated iOS Info.plist must not configure native Sentry');
  return errors;
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const errors=checkNativeCrashConfig({
    appDelegate:readFileSync('ios/TrueTone/AppDelegate.swift','utf8'),
    infoPlist:readFileSync('ios/TrueTone/Info.plist','utf8'),
  });
  if(errors.length) {console.error(errors.join('\n'));process.exitCode=1;}
  else console.log('Generated iOS startup has no native Sentry import, startup call, or plist configuration');
}
