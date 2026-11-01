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
