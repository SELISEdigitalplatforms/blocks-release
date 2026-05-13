import { ForwardRefExoticComponent } from "react";
import { DeploymentData } from "./github-info";

interface IconMap {
  [key: string]: ForwardRefExoticComponent<unknown>;
}
interface Provider {
  id: string;
  name: string;
  icon: keyof IconMap;
  active: boolean;
}

const repositories = [
  { label: "SELISEdigitalplatforms/l3-react-blocks-construct", value: "repo-1" },
  { label: "SELISEdigitalplatforms/design-system", value: "repo-2" },
  { label: "SELISEdigitalplatforms/frontend-core", value: "repo-3" },
  { label: "SELISEdigitalplatforms/ui-library", value: "repo-4" },
  { label: "SELISEdigitalplatforms/shared-components", value: "repo-5" },
];

const branches = [
  { label: "main", value: "main" },
  { label: "develop", value: "develop" },
  { label: "feature/new-ui", value: "feature/new-ui" },
  { label: "bugfix/header-issue", value: "bugfix/header-issue" },
  { label: "release/v2.0.0", value: "release/v2.0.0" },
];

const providers: Provider[] = [
  { id: "github", name: "GitHub", icon: "github", active: true },
  { id: "gitlab", name: "GitLab", icon: "gitlab", active: false },
  { id: "bitbucket", name: "Bitbucket", icon: "bitbucket", active: false },
  { id: "azure", name: "Azure", icon: "azure", active: false },
  { id: "aws", name: "AWS", icon: "aws", active: false },
];
const DEPLOYMENT_OPTIONS = [
  { value: "auto", label: "Git based deployment" },
  { value: "manual", label: "Blocks Cloud based deployment" },
];
const FRAMEWORK_OPTIONS = [
  { value: "", label: "Select framework" },
  { value: "react", label: "React" },
  { value: "vue", label: "Vue" },
  { value: "angular", label: "Angular" },
  { value: "svelte", label: "Svelte" },
  { value: "next", label: "Next.js" },
  { value: "nuxt", label: "Nuxt.js" },
];
const PROVIDER_OPTIONS = [
  { value: "aws", label: "AWS" },
  { value: "gcp", label: "Google Cloud" },
  { value: "azure", label: "Azure" },
];
const REGION_OPTIONS = [
  { value: "", label: "Select region" },
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "eu-west-1", label: "Europe (Ireland)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
];

const SPECIFICATION_OPTIONS = [
  { os: "512 MiB", core: "1 CPU", ram: "500", logo: "", id: "1" },
  { os: "1 GiB", core: "1 CPU", ram: "1,000", logo: "", id: "2" },
  { os: "2 GiB", core: "2 CPUs", ram: "3,000", logo: "", id: "3" },
  { os: "8 GiB", core: "4 CPUs", ram: "5,000", logo: "", id: "4" },
  { os: "16 GiB", core: "8 CPUs", ram: "7,000", logo: "", id: "5" },
];
// export interface BuildStep {
//   id: string;
//   name: string;
//   status: "success" | "error" | "running" | "pending";
//   duration: string;
//   logs?: string[];
// }
const deployments: DeploymentData[] = [
  {
    id: "1",
    environment: "master@HEAD",
    status: "Published",
    date: "Today at 05:46 PM",
    time: "",
    deployedIn: "36s",
    hasMessage: false,
    actions: ["SAST", "SCA", "DAST"],
    message: "",
    commitId: "",
  },
  {
    id: "2",
    environment: "master@HEAD",
    status: "Deployed",
    date: "Yesterday at 09:30 AM",
    time: "",
    deployedIn: "1m22s",
    hasMessage: true,
    actions: ["SAST", "SCA", "DAST"],
    message: "",
    commitId: "",
  },
  {
    id: "3",
    environment: "master@HEAD",
    status: "Deployed",
    date: "12/04/2025 at 12:48 PM",
    time: "",
    deployedIn: "35s",
    hasMessage: true,
    actions: ["SAST", "SCA", "DAST"],
    message: "",
    commitId: "",
  },
  {
    id: "4",
    environment: "master@HEAD",
    status: "Deployed",
    date: "11/04/2025 at 04:52 PM",
    time: "",
    deployedIn: "1m 1s",
    hasMessage: true,
    actions: ["SAST", "SCA", "DAST"],
    message: "",
    commitId: "",
  },
];

const buildSteps = [
  {
    id: "1",
    name: "Set up job",
    status: "success",
    duration: "131.848ms",
    logs: [
      "Runner image: ubuntu-latest",
      "Starting job execution",
      "Job setup completed successfully",
    ],
  },
  {
    id: "2",
    name: "Run actions/checkout@v3",
    status: "success",
    duration: "131.848ms",
    logs: ["Checking out repository", "Syncing repository to runner", "Checkout completed"],
  },
  {
    id: "3",
    name: "Update submodule",
    status: "success",
    duration: "131.848ms",
    logs: ["Initializing submodules", "Updating submodules", "Submodule update completed"],
  },
  {
    id: "4",
    name: "Set Environment Variables",
    status: "success",
    duration: "131.848ms",
    logs: [
      "Setting NODE_ENV=production",
      "Setting BUILD_MODE=release",
      "Environment variables configured",
    ],
  },
  {
    id: "5",
    name: "Remove invisible CSS classes",
    status: "success",
    duration: "131.848ms",
    logs: ["Scanning CSS files", "Removing unused classes", "CSS optimization completed"],
  },
  {
    id: "6",
    name: "Azure login",
    status: "success",
    duration: "131.848ms",
    logs: ["Authenticating with Azure", "Login successful", "Azure CLI configured"],
  },
  {
    id: "7",
    name: "Build and push image to ACR",
    status: "success",
    duration: "131.848ms",
    logs: [
      "Building Docker image",
      "Tagging image for ACR",
      "Pushing image to registry",
      "Image push completed",
    ],
  },
  {
    id: "8",
    name: "Post Run action/checkout@v3",
    status: "error",
    duration: "131.848ms",
    logs: ["Running post-checkout actions", "Error: Failed to clean up workspace", "Exit code: 1"],
  },
];
const deploySteps = [
  {
    id: "1",
    name: "Set up job",
    status: "success",
    duration: "6s",
    logs: [
      "Current runner version: '2.324.0'",
      "Runner Image Provisioner",
      "Operating System",
      "Runner Image",
      "GITHUB_TOKEN Permissions",
      "Secret source: Actions",
      "Prepare workflow directory",
      "Prepare all required actions",
      "Getting action download info",
      "Download action repository 'azure/login@v1.4.6' (SHA:92a5484dfaf04ca78a94597f4f19fea033851fa2)",
      "Download action repository 'azure/aks-set-context@v3' (SHA:4ed3ae69f90305937fee8c85189ac03a21d3a58)",
      "Download action repository 'Azure/setup-helm@v3.5' (SHA:5119fcb880d432beecbf790c2c79152073440c78)",
      "Complete job name: cd-job / deployWebToK8s",
    ],
  },
  {
    id: "2",
    name: "Run actions/checkout@v3",
    status: "success",
    duration: "1s",
    logs: ["Checking out repository", "Syncing repository to runner", "Checkout completed"],
  },
  {
    id: "3",
    name: "Update submodule",
    status: "success",
    duration: "0s",
    logs: ["Initializing submodules", "Updating submodules", "Submodule update completed"],
  },
  {
    id: "4",
    name: "Set Environment Variables",
    status: "success",
    duration: "0s",
    logs: [
      "Setting KUBECONFIG environment",
      "Setting NAMESPACE=production",
      "Environment variables configured",
    ],
  },
  {
    id: "5",
    name: "Azure login",
    status: "success",
    duration: "15s",
    logs: ["Authenticating with Azure", "Login successful", "Azure CLI configured"],
  },
  {
    id: "6",
    name: "pull helm repo",
    status: "success",
    duration: "0s",
    logs: ["Adding helm repositories", "Updating helm repo index", "Helm repo ready"],
  },
  {
    id: "7",
    name: "Get K8s context",
    status: "success",
    duration: "0s",
    logs: ["Getting AKS credentials", "Setting kubectl context", "Kubernetes context configured"],
  },
  {
    id: "8",
    name: "Setup Helm installer",
    status: "success",
    duration: "1s",
    logs: ["Installing Helm", "Configuring Helm client", "Helm setup completed"],
  },
  {
    id: "9",
    name: "Deploy to Kubernetes",
    status: "success",
    duration: "0s",
    logs: ["Applying Kubernetes manifests", "Rolling out deployment", "Deployment successful"],
  },
  {
    id: "10",
    name: "Post pull helm repo",
    status: "success",
    duration: "3s",
    logs: ["Cleaning up helm cache", "Post-deployment cleanup", "Cleanup completed"],
  },
  {
    id: "11",
    name: "Post Run action/checkout@v3",
    status: "error",
    duration: "1s",
    logs: ["Running post-checkout actions", "Error: Failed to clean up workspace", "Exit code: 1"],
  },
  {
    id: "12",
    name: "Complete job",
    status: "pending",
    duration: "0s",
    logs: ["Finalizing job execution", "Generating job summary", "Job completion pending"],
  },
];

export {
  repositories,
  branches,
  providers,
  FRAMEWORK_OPTIONS,
  PROVIDER_OPTIONS,
  REGION_OPTIONS,
  DEPLOYMENT_OPTIONS,
  SPECIFICATION_OPTIONS,
  buildSteps,
  deploySteps,
  deployments,
};
