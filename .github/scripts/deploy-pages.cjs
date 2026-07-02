'use strict';

/* global module, process, setTimeout */

const FINAL_ERROR_STATUS = {
  deployment_failed: 'Deployment failed, try again later.',
  deployment_content_failed:
    'Artifact could not be deployed. Ensure the content has no hard links or symlinks and is less than 10 GB.',
  deployment_cancelled: 'Deployment cancelled.',
  deployment_lost: 'Deployment failed to report final status.',
};

const TEMPORARY_STATUS = {
  unknown_status: 'Unable to get deployment status.',
  not_found: 'Deployment not found.',
  deployment_attempt_error: 'Deployment temporarily failed; GitHub Pages should retry it.',
};

const DEFAULT_TIMEOUT_MS = 45 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 15 * 1000;
const DEFAULT_MAX_STATUS_ERRORS = 10;

function readPositiveInteger(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDeploymentId(deployment, buildVersion) {
  return deployment.id || deployment.status_url?.split('/').pop() || buildVersion;
}

async function getPagesArtifact({ github, context, core }) {
  const { owner, repo } = context.repo;
  const artifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, {
    owner,
    repo,
    run_id: context.runId,
    per_page: 100,
  });

  const matches = artifacts.filter(
    (artifact) => artifact.name === 'github-pages' && !artifact.expired
  );
  if (matches.length !== 1) {
    throw new Error(`Expected one non-expired "github-pages" artifact, found ${matches.length}.`);
  }

  const artifact = matches[0];
  core.info(`Using Pages artifact ${artifact.id} (${artifact.size_in_bytes} bytes).`);
  return artifact;
}

async function createPagesDeployment({ github, context, core, artifact }) {
  const { owner, repo } = context.repo;
  const idToken = await core.getIDToken();

  const response = await github.request('POST /repos/{owner}/{repo}/pages/deployments', {
    owner,
    repo,
    artifact_id: artifact.id,
    pages_build_version: context.sha,
    oidc_token: idToken,
  });

  const deployment = response.data;
  const deploymentId = getDeploymentId(deployment, context.sha);
  const pageUrl = deployment.page_url || '';

  core.setOutput('deployment_id', deploymentId);
  if (pageUrl) {
    core.setOutput('page_url', pageUrl);
  }

  core.info(`Created Pages deployment ${deploymentId} for ${context.sha}.`);
  return { deployment, deploymentId };
}

async function getPagesDeploymentStatus({ github, context, deploymentId }) {
  const { owner, repo } = context.repo;
  const response = await github.request(
    'GET /repos/{owner}/{repo}/pages/deployments/{deploymentId}',
    {
      owner,
      repo,
      deploymentId,
    }
  );

  return response.data;
}

async function waitForPagesDeployment({ github, context, core, deployment, deploymentId }) {
  const timeoutMs = readPositiveInteger('PAGES_DEPLOY_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
  const pollIntervalMs = readPositiveInteger(
    'PAGES_DEPLOY_POLL_INTERVAL_MS',
    DEFAULT_POLL_INTERVAL_MS
  );
  const maxStatusErrors = readPositiveInteger(
    'PAGES_DEPLOY_MAX_STATUS_ERRORS',
    DEFAULT_MAX_STATUS_ERRORS
  );
  const deadline = Date.now() + timeoutMs;

  let errorCount = 0;
  let lastStatus = 'unknown_status';

  core.info(`Waiting up to ${Math.round(timeoutMs / 60000)} minutes for GitHub Pages deployment.`);

  while (Date.now() < deadline) {
    await sleep(pollIntervalMs);

    try {
      const status = await getPagesDeploymentStatus({ github, context, deploymentId });
      lastStatus = status.status || 'unknown_status';
      errorCount = 0;

      if (lastStatus === 'succeed') {
        const pageUrl = status.page_url || deployment.page_url || '';
        if (pageUrl) {
          core.setOutput('page_url', pageUrl);
        }
        core.info(`Reported success: ${pageUrl || deploymentId}`);
        return;
      }

      if (FINAL_ERROR_STATUS[lastStatus]) {
        throw new Error(FINAL_ERROR_STATUS[lastStatus]);
      }

      if (TEMPORARY_STATUS[lastStatus]) {
        core.warning(TEMPORARY_STATUS[lastStatus]);
      } else {
        core.info(`Current status: ${lastStatus}`);
      }
    } catch (error) {
      if (FINAL_ERROR_STATUS[lastStatus]) {
        throw error;
      }

      errorCount += 1;
      core.warning(
        `Could not read Pages deployment status (${errorCount}/${maxStatusErrors}): ${error.message}`
      );
      if (errorCount >= maxStatusErrors) {
        throw error;
      }
    }
  }

  throw new Error(
    `Timed out waiting for Pages deployment ${deploymentId}; last status: ${lastStatus}. ` +
      'The deployment was left active instead of being cancelled.'
  );
}

module.exports = async function deployPages({ github, context, core }) {
  const artifact = await getPagesArtifact({ github, context, core });
  const { deployment, deploymentId } = await createPagesDeployment({
    github,
    context,
    core,
    artifact,
  });
  await waitForPagesDeployment({ github, context, core, deployment, deploymentId });
};
