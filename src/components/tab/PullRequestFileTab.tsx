import { MainAreaWidget } from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { PromiseDelegate } from '@lumino/coreutils';
import { Panel } from '@lumino/widgets';
import { IDiffOptions, IFileDiff, IThread } from '../../tokens';
import { requestAPI } from '../../utils';
import { NotebookDiff } from '../diff/notebook';
import { PlainTextDiff } from '../diff/plaintext';

export interface IFileDiffWidgetProps {
  filename: string;
  pullRequestId: string;
  renderMime: IRenderMimeRegistry;
  settingsRegistry: ISettingRegistry | null;
}

// FIXME change for a factory?
export class FileDiffWidget extends MainAreaWidget<Panel> {
  constructor(props: IFileDiffWidgetProps) {
    const content = new Panel();
    const isLoaded = new PromiseDelegate<void>();
    super({
      content,
      reveal: isLoaded.promise
    });
    content.addClass('jp-PullRequestTab');

    FileDiffWidget.loadDiff(props.pullRequestId, props.filename)
      .then(([diff, threads]) => {
        isLoaded.resolve();
        this.showDiff({
          ...props,
          diff,
          threads
        });
      })
      .catch(reason => {
        let msg = `Load File Error (${reason.message})`;
        if (
          reason.message.toLowerCase().includes("'utf-8' codec can't decode")
        ) {
          msg = `Diff for ${props.filename} is not supported.`;
        }
        isLoaded.reject(msg);
      });
  }

  protected static async loadDiff(
    pullRequestId: string,
    filename: string
  ): Promise<[IFileDiff, IThread[]]> {
    return Promise.all([
      requestAPI<IFileDiff>(
        `pullrequests/files/content?id=${encodeURIComponent(
          pullRequestId
        )}&filename=${encodeURIComponent(filename)}`,
        'GET'
      ),
      requestAPI<IThread[]>(
        `pullrequests/files/comments?id=${encodeURIComponent(
          pullRequestId
        )}&filename=${encodeURIComponent(filename)}`,
        'GET'
      )
    ]);
  }

  protected showDiff(diffProps: IDiffOptions): void {
    const fileExtension = PathExt.extname(diffProps.filename).toLowerCase();
    if (fileExtension === '.ipynb') {
      this.content.addWidget(new NotebookDiff(diffProps));
    } else {
      try {
        this.content.addWidget(new PlainTextDiff(diffProps));
      } catch (reason) {
        this.showError(reason.message || reason);
      }
    }
  }

  protected showError(message: string): void {
    while (this.children().next()) {
      this.children()
        .next()
        .dispose();
    }
    this.node.innerHTML = `<h2 class="jp-PullRequestTabError"><span style="color: 'var(--jp-ui-font-color1)';">Error Loading File:</span> ${message}</h2>`;
  }
}
