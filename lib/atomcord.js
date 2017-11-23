'use babel';

import AtomRichPresenceView from './atomcord-view';
import { CompositeDisposable } from 'atom';

export default {

  atomRichPresenceView: null,

  activate(state) {
    this.atomRichPresenceView = new AtomRichPresenceView(state.atomRichPresenceViewState);
  },

  deactivate() {
    this.atomRichPresenceView.destroy();
  },

  serialize() {
    return {
      atomRichPresenceViewState: this.atomRichPresenceView.serialize()
    };
  }
};
