/**
 * i18n modules. English lives here (`<module>.en.json`); other languages come from the
 * localization service.
 *
 * - `release.deployment.alerts` (26 keys): cross-modules/deployment/components/alert
 * - `release.deployment.details` (84 keys): cross-modules/deployment/components/deployment-details (except tabs), utils/deployment-logs
 * - `release.deployment.home` (33 keys): cross-modules/deployment/components/deployment-home
 * - `release.deployment.pages` (39 keys): cross-modules/deployment/pages
 * - `release.deployment.scans` (147 keys): cross-modules/deployment/components/deployment-details/tabs, utils/sast-metrics
 * - `release.deployment.secrets` (88 keys): cross-modules/deployment/components/repo-secrets
 * - `release.deployment.shared` (33 keys): cross-modules/deployment/components/deployment-steps, models, constants
 * - `release.idp` (46 keys): cross-modules/idp, cross-modules/communication, components/blocks-login-page
 * - `release.launcher` (158 keys): components/blocks-app-launcher, constants/blocks-products
 * - `release.shared` (123 keys): components (all except login/launcher), hooks, layouts, pages, routes, lib, constants, ui-kits
 * Total: 777 keys.
 */
// English text of every module, registered before the first render.
import { registerTranslations } from "@seliseblocks/genesis-os";
import releaseDeploymentAlerts from "./release.deployment.alerts.en.json";
import releaseDeploymentDetails from "./release.deployment.details.en.json";
import releaseDeploymentHome from "./release.deployment.home.en.json";
import releaseDeploymentPages from "./release.deployment.pages.en.json";
import releaseDeploymentScans from "./release.deployment.scans.en.json";
import releaseDeploymentSecrets from "./release.deployment.secrets.en.json";
import releaseDeploymentShared from "./release.deployment.shared.en.json";
import releaseIdp from "./release.idp.en.json";
import releaseLauncher from "./release.launcher.en.json";
import releaseShared from "./release.shared.en.json";

registerTranslations("release.deployment.alerts", releaseDeploymentAlerts);
registerTranslations("release.deployment.details", releaseDeploymentDetails);
registerTranslations("release.deployment.home", releaseDeploymentHome);
registerTranslations("release.deployment.pages", releaseDeploymentPages);
registerTranslations("release.deployment.scans", releaseDeploymentScans);
registerTranslations("release.deployment.secrets", releaseDeploymentSecrets);
registerTranslations("release.deployment.shared", releaseDeploymentShared);
registerTranslations("release.idp", releaseIdp);
registerTranslations("release.launcher", releaseLauncher);
registerTranslations("release.shared", releaseShared);
