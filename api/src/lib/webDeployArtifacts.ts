import { config } from '../config.js';
import { imageUploadService } from './imageUpload.js';
import { resolveTokenImageUrl } from './tokenImageUrl.js';

export type WebDeployArtifactsInput = {
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  websiteUrl?: string;
  xUrl?: string;
  platform?: string;
  clientKind?: 'web' | 'agent';
};

export type WebDeployArtifacts = {
  image: string;
  metadata: string;
  context: string;
};

function liquidDeployContextInterface(
  params: Pick<WebDeployArtifactsInput, 'platform' | 'clientKind'>,
): string {
  if (params.platform === 'web' && params.clientKind === 'agent') {
    return 'agent';
  }
  const p = params.platform?.trim().toLowerCase();
  if (!p) return config.liquidDeployContextInterfaceFallback;
  switch (p) {
    case 'x':
    case 'telegram':
    case 'discord':
    case 'farcaster':
    case 'web':
      return p;
    default:
      return config.liquidDeployContextInterfaceFallback;
  }
}

/** Resolve logo URL, build on-chain metadata + context JSON (shared by server and wallet deploy). */
export async function buildWebDeployArtifacts(
  params: WebDeployArtifactsInput,
): Promise<WebDeployArtifacts> {
  let image = params.imageUrl ?? '';

  if (image && imageUploadService.isConfigured()) {
    const uploadedUrl = await imageUploadService.uploadTokenImage(image, params.name);
    if (uploadedUrl) {
      image = uploadedUrl;
    }
  }
  image = resolveTokenImageUrl(image) ?? image;
  if (image.startsWith('data:')) {
    throw new Error(
      'Token image could not be stored. Use a public HTTPS image URL, or set PINATA_JWT on the server for logo uploads.',
    );
  }

  const metadataPayload: Record<string, string | number> = {
    name: params.name,
    symbol: params.symbol,
  };
  if (params.description?.trim()) {
    metadataPayload.description = params.description.trim();
  }
  if (image) {
    metadataPayload.image = image;
  }
  if (params.websiteUrl?.trim()) {
    metadataPayload.external_url = params.websiteUrl.trim();
  }
  if (params.xUrl?.trim()) {
    metadataPayload.twitter = params.xUrl.trim();
  }
  if (config.platformFeeBps > 0) {
    metadataPayload.platformFeeBps = config.platformFeeBps;
    metadataPayload.platformFeePercent = Number((config.platformFeeBps / 100).toFixed(2));
  }

  const contextPayload: Record<string, string | number> = {
    interface: liquidDeployContextInterface(params),
    platform: config.liquidDeployContextPlatform,
  };
  if (config.platformFeeBps > 0) {
    contextPayload.platformFeeBps = config.platformFeeBps;
  }
  if (config.platformFeeRecipient) {
    contextPayload.platformFeeRecipient = config.platformFeeRecipient;
  }

  return {
    image,
    metadata: JSON.stringify(metadataPayload),
    context: JSON.stringify(contextPayload),
  };
}
