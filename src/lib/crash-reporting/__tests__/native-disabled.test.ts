import type { Envelope } from '@sentry/core';

// Exercise the installed SDK's real bridge wrapper. Only the device bridge is substituted.
const mockBridge = {
  initNativeSdk: jest.fn(async () => true),
  crash: jest.fn(),
  captureEnvelope: jest.fn(),
};

function launch() {
  let load: (() => typeof import('@sentry/react-native/dist/js/wrapper').NATIVE) | undefined;
  jest.isolateModules(() => {
    const { NativeModules }: typeof import('react-native') = require('react-native');
    NativeModules.RNSentry = mockBridge;
    const { NATIVE }: typeof import('@sentry/react-native/dist/js/wrapper') = require('@sentry/react-native/dist/js/wrapper');
    load = () => NATIVE;
  });
  if (!load) throw new Error('SDK wrapper not loaded');
  return load();
}

test('native startup, crash recording and envelope delivery stay disabled across fresh JS launches', async () => {
  jest.clearAllMocks();
  const envelope: Envelope = [{event_id:'a'.repeat(32),sent_at:'2026-11-13T00:00:00Z'},[[{type:'event'},{message:'synthetic native crash'}]]];
  for (let restart = 0; restart < 2; restart += 1) {
    const native = launch();
    expect(await native.initNativeSdk({ enableNative: false, autoInitializeNativeSdk: false, enableNativeCrashHandling: false, devServerUrl: undefined, defaultSidecarUrl: undefined, mobileReplayOptions: undefined })).toBe(false);
    native.nativeCrash();
    await native.sendEnvelope(envelope);
  }
  expect(mockBridge.initNativeSdk).not.toHaveBeenCalled();
  expect(mockBridge.crash).not.toHaveBeenCalled();
  expect(mockBridge.captureEnvelope).not.toHaveBeenCalled();
});

test('control: the same bridge detects native startup and crash calls when explicitly enabled', async () => {
  jest.clearAllMocks();
  const native = launch();
  expect(await native.initNativeSdk({ dsn:'https://public@example.invalid/1', enableNative:true, autoInitializeNativeSdk:true, devServerUrl:undefined, defaultSidecarUrl:undefined, mobileReplayOptions:undefined })).toBe(true);
  native.nativeCrash();
  expect(mockBridge.initNativeSdk).toHaveBeenCalledTimes(1);
  expect(mockBridge.crash).toHaveBeenCalledTimes(1);
});
