import { flushPromises, mount } from '@vue/test-utils';
import { IDBFactory } from 'fake-indexeddb';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App.vue';
import { useCameraStore } from '../camera/camera-store';
import { NEUTRAL_IDS } from '../chart/layouts';
import type { Rgb } from '../chart/types';
import { setLocale } from '../lang';
import { useProjectStore } from '../project/project-store';
import { setReferenceStorage, useReferenceStore } from '../reference/reference-store';
import { createIndexedDbStorage } from '../reference/storage';
import { useSolveStore } from '../solve/solve-store';
import { dummyIds, dummyLab, dummyReferenceJson } from '../test-support/dummy-reference';
import { installFakeCamera, installMediaStubs } from '../test-support/media';
import { cameraCode } from '../test-support/synthetic-camera';

import CameraControls from './CameraControls.vue';
import CameraToggle from './CameraToggle.vue';
import ExportTab from './ExportTab.vue';
import ProjectBar from './ProjectBar.vue';
import ProjectStatus from './ProjectStatus.vue';
import ReferencePanel from './ReferencePanel.vue';
import SettingsMenu from './SettingsMenu.vue';

vi.mock('../lut/download', () => ({ downloadFile: vi.fn() }));

describe('user interface texts in English', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    setReferenceStorage(createIndexedDbStorage(new IDBFactory(), 'texts-en'));
    installMediaStubs();
    setLocale('en');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('labels the camera switch in every state', async () => {
    installFakeCamera();
    const wrapper = mount(CameraToggle);
    const toggle = wrapper.get('[data-testid="camera-toggle"]');
    expect(toggle.text()).toBe('Start camera');
    expect(toggle.attributes('aria-label')).toBe('Camera');
    useCameraStore().status = 'starting';
    await flushPromises();
    expect(toggle.text()).toBe('Starting camera …');
    useCameraStore().status = 'live';
    await flushPromises();
    expect(toggle.text()).toBe('Stop camera');
  });

  it('shows the camera controls in English', async () => {
    installFakeCamera();
    const wrapper = mount(CameraControls);
    expect(wrapper.text()).toContain('Default camera');
    expect(wrapper.text()).toContain('Resolution');
    expect(wrapper.get('[role="note"]').text()).toContain('Lock auto exposure');
    await useCameraStore().start();
    await flushPromises();
    expect(wrapper.text()).toContain('Active resolution: 1280 × 720');
  });

  it('shows the settings menu in English', async () => {
    const wrapper = mount(SettingsMenu, { attachTo: document.body });
    const gear = wrapper.get('[data-testid="settings-button"]');
    expect(gear.attributes('aria-label')).toBe('Settings');
    expect(gear.attributes('title')).toBe('Settings');
    await gear.trigger('click');
    expect(wrapper.get('[data-testid="section-camera"]').text()).toContain('Camera');
    expect(wrapper.get('[data-testid="section-camera"]').text()).toContain('Default camera');
    expect(wrapper.get('[data-testid="section-reference"]').text()).toContain('Reference values');
    expect(wrapper.get('[data-testid="section-reference"]').text()).toContain('Bundled set');
    wrapper.unmount();
  });

  it('shows the reference panel in English', () => {
    const wrapper = mount(ReferencePanel);
    const source = wrapper.get('[data-testid="reference-source"]').text();
    expect(source).toContain(
      'comes from the blog post bartneck.de and is not a file from Datacolor',
    );
    expect(wrapper.text()).toContain('Active set');
    expect(wrapper.text()).toContain('Import your own file (JSON or CSV)');
    expect(wrapper.find('[data-testid="reference-download"]').exists()).toBe(false);
  });

  it('shows the reference actions and messages in English', async () => {
    const wrapper = mount(ReferencePanel);
    const store = useReferenceStore();
    await store.load();
    await store.importFile('a.json', dummyReferenceJson('Set A'));
    await flushPromises();
    expect(wrapper.text()).toContain('Delete set');
    expect(wrapper.text()).toContain('Download set');
    expect(wrapper.get('[data-testid="reference-saved"]').text()).toBe(
      'Saved locally in the browser.',
    );
    await store.remove('Set A');
    await flushPromises();
    expect(wrapper.get('[data-testid="reference-removed"]').text()).toBe(
      'Set “Set A” deleted locally.',
    );
  });

  it('shows the project bar and messages in English', async () => {
    const bar = mount(ProjectBar);
    expect(bar.text()).toContain('Include still images');
    expect(bar.text()).toContain('Save project');
    expect(bar.text()).toContain('Load project');
    const status = mount(ProjectStatus);
    useProjectStore().notice = 'Note';
    await flushPromises();
    expect(status.get('[data-testid="project-message-close"]').attributes('aria-label')).toBe(
      'Dismiss message',
    );
  });

  it('shows an English notice for a missing reference set', async () => {
    const project = useProjectStore();
    const raw = {
      format: 'cam_gradr-project/1',
      gray: { corners: {}, measurements: {} },
      color: { corners: {}, measurements: {}, reference: 'Missing set' },
      model: null,
      preview: { split: 50 },
    };
    await project.load(JSON.stringify(raw));
    expect(project.notice).toContain('The reference set “Missing set” is not available');
    await project.load('{"format":"x"}');
    expect(project.error).toContain('Unknown format');
  });

  it('shows the export tab in English without a color correction', () => {
    const wrapper = mount(ExportTab);
    expect(wrapper.text()).toContain('LUT for monitor or software');
    expect(wrapper.text()).toContain('The color correction as a .cube file');
    expect(wrapper.get('[data-testid="export-no-model"]').text()).toContain(
      'No color correction yet.',
    );
    expect(wrapper.get('[data-testid="export-no-model"]').text()).toContain('Go to color cards');
    expect(wrapper.get('[data-testid="export-download"]').text()).toBe(
      'Download cam_gradr-33.cube',
    );
    expect(wrapper.get('[data-testid="export-size-33"]').text()).toBe('33³ default');
    expect(wrapper.get('[data-testid="export-size-17"]').text()).toBe('17³');
    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe(
      'LUT size (grid points per axis)',
    );
    const facts = wrapper.get('[data-testid="project-facts"]').text();
    expect(facts).toContain('Gray cards–');
    expect(facts).toContain('Correction–');
    expect(wrapper.text()).toContain('Back up project');
    expect(wrapper.text()).toContain('as .json');
  });

  it('shows the export tab in English with a color correction', () => {
    const reference = {
      name: 'Test',
      patches: Object.fromEntries(dummyIds().map((id) => [id, dummyLab(id)])),
    };
    const measurements: Record<string, Rgb> = Object.fromEntries(
      dummyIds().map((id) => [id, cameraCode(dummyLab(id))]),
    );
    useSolveStore().compute({ measurements, reference, neutralIds: NEUTRAL_IDS });
    const wrapper = mount(ExportTab);
    expect(wrapper.get('[data-testid="export-file-info"]').text()).toBe(
      '33 × 33 × 33 · about 970 KB',
    );
    expect(wrapper.get('[data-testid="project-facts"]').text()).toContain('Curves + matrix');
  });

  it('shows the tabs, hints and footer of the app in English', () => {
    installFakeCamera();
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mount(App, { global: { plugins: [pinia] } });
    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs.map((tab) => tab.attributes('aria-label'))).toEqual([
      'Gray cards',
      'Color cards',
      'Preview',
      'Export',
    ]);
    expect(tabs[0]?.text()).toContain('Not measured yet');
    expect(tabs[1]?.text()).toContain('Not computed yet');
    expect(tabs[2]?.text()).toContain('Original / corrected');
    expect(tabs[3]?.text()).toContain('.cube, project');
    expect(wrapper.get('[role="tablist"]').attributes('aria-label')).toBe('Sections');
    expect(wrapper.get('footer').text()).toContain('LUT generator for the Spyder Checkr Photo.');
  });
});
