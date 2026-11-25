// =====================================================
//  SuperX_RobRunPatchNotes - Config (GitHub Actions version)
//  The webhook link goes in GitHub Secrets, NOT here.
//  The role to ping goes in GitHub Variables as ROLE_ID (optional).
// =====================================================
module.exports = {
  // ROB RUN on Steam (Kefir). Change to track a different Steam game.
  steamAppId: 4262460,
  gameName: 'ROB RUN',
  developer: 'Kefir',

  //  'patchnotes' = only patch/update/hotfix posts
  //  'all'        = every official announcement (events, news, etc.)
  postMode: 'patchnotes',
  patchKeywords: ['patch', 'update', 'hotfix', 'hot fix', 'fix', 'changelog', 'version', 'v0.', 'v1.', 'maintenance'],

  // On the very first run, old posts are marked as seen. true = also post the newest one.
  postLatestOnFirstRun: true,

  // How the webhook shows up in Discord
  webhook: {
    username: 'SuperX_RobRunPatchNotes',
    avatarUrl: '', // optional: link to a PNG for the avatar (leave empty to use the webhook's own avatar)
  },

  // Embed style (SuperX lime green + black)
  embed: {
    color: 0x9EFF00,
    footerText: 'SuperX_Customs • ROB RUN Patch Notes',
    authorName: 'ROB RUN • Kefir',
    announceText: 'a new ROB RUN patch just dropped',
    showImage: true,
  },
};
