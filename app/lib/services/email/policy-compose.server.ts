import { getAccountManager } from "~/lib/services/account-managers/service";
import { getAuthorisedRepresentative } from "~/lib/services/authorised-representatives/service";
import { listEmailDirectory } from "~/lib/services/email/directory.server";
import { getEmailFooterImage } from "~/lib/services/email/footer-image.server";
import { listEmailTemplates } from "~/lib/services/email/templates.server";

/** Email dialog context — loaded on demand when the user opens Send email. */
export async function getPolicyEmailComposeContext(client: {
  authorisedRepresentativeId: number | null;
  accountManagerId: number | null;
}) {
  const [templates, footer, directory] = await Promise.all([
    listEmailTemplates(),
    getEmailFooterImage(),
    listEmailDirectory(),
  ]);
  const [broker, accountManager] = await Promise.all([
    client.authorisedRepresentativeId != null
      ? getAuthorisedRepresentative(client.authorisedRepresentativeId)
      : Promise.resolve(null),
    client.accountManagerId != null
      ? getAccountManager(client.accountManagerId)
      : Promise.resolve(null),
  ]);

  return {
    templates,
    footerImageDataUri: footer.dataUri,
    footerImageWidth: footer.displayWidth,
    broker,
    accountManager,
    directory,
  };
}
