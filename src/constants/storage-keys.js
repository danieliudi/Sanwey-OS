// Namespace every key with a version so schema changes invalidate old data.
const V = "v4";

export const STORAGE_KEYS = {
  currentUser: `gs_${V}_current_user`,
  users: `gs_${V}_users`,
  leads: `gs_${V}_leads`,
  pipelines: `gs_${V}_pipelines`,
  notifications: `gs_${V}_notifications`,
  settings: `gs_${V}_settings`,
  starred: `gs_${V}_starred`,
  crossReferrals: `gs_${V}_cross_referrals`,
  crossReferralOverrides: `gs_${V}_cross_referral_overrides`,
  userSettings: `gs_${V}_user_settings`,
  pipelineTransitions: `gs_${V}_pipeline_transitions`,
  automations: `gs_${V}_automations`,
  leadFormConfig: `gs_${V}_lead_form_config`,
  changelogSeen: `gs_${V}_changelog_seen`,
  screenTipsSeen: `gs_${V}_screen_tips_seen`,
  agentsCoachmarkSeen: `gs_${V}_agents_coachmark_seen`,
  featureSpotlightsSeen: `gs_${V}_feature_spotlights_seen`,
  platformTourSeen: `gs_${V}_platform_tour_seen`,
  weeklyDigestLastSent: `gs_${V}_weekly_digest_last_sent`,
  dashboardWidgetPrefs: `gs_${V}_dashboard_widget_prefs`,
  bottomNavPrefs: `gs_${V}_bottom_nav_prefs`,
};
