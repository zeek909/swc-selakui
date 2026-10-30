/**
 * Gives the Windows program its SWC icon and name, and turns off Electron
 * features this app does not need. Usage: node patch-exe.js <exe> <ico> <version>
 * Needs: npm install resedit@2 @electron/fuses@1
 */
'use strict';
const fs = require('fs');
const ResEdit = require('resedit');
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');

const [exePath, icoPath, version] = process.argv.slice(2);

const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
const res = ResEdit.NtExecutableResource.from(exe);
const icon = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath));
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, 1, 1033, icon.icons.map(i => i.data));

const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
const v = version.split('.').map(Number);
vi.setFileVersion(v[0], v[1], v[2], 0, 1033);
vi.setProductVersion(v[0], v[1], v[2], 0, 1033);
vi.setStringValues({ lang: 1033, codepage: 1200 }, {
  FileDescription: 'SWC Selakui',
  ProductName: 'SWC Selakui',
  CompanyName: 'Staff Welfare Committee, TCV School Selakui',
  InternalName: 'SWC Selakui',
  OriginalFilename: 'SWC Selakui.exe',
  LegalCopyright: ''
});
vi.outputToResourceEntries(res.entries);
res.outputResource(exe);
fs.writeFileSync(exePath, Buffer.from(exe.generate()));

flipFuses(exePath, {
  version: FuseVersion.V1,
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false
}).then(() => console.log('Patched ' + exePath));
