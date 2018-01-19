import { Component } from '@angular/core';
import sample from 'lodash-es/sample';

@Component({
  selector: 'app-loading-modal',
  templateUrl: './loading-modal.component.html',
  styleUrls: ['./loading-modal.component.css']
})
export class LoadingModalComponent {
  currentWord;

  private words = [
    'May the force be with you.',
    'There\'s always a bigger fish.',
    'Power! Unlimited power!',
    'Chewie, we\'re home.',
    'One ring to rule them all',
    'If I\'m not back in five minutes, just wait longer.',
    'We apologize for the inconvenience.',
    'Never argue with the data.',
    'No matter where you go, there you are.',
    'I find your lack of faith disturbing.',
    'Do, or do not. There is no try.',
    'I\'d just as soon kiss a wookiee!',
    'I know kung fu.',
    'Yeah, well. The Dude abides.',
    'Time is a drug. Too much of it kills you.',
    'The turtle moves.',
    'Gravity is a habit that is hard to shake off.',
    'One day a tortoise will learn how to fly.',
    'Thou shalt not submit thy god to market forces.',
    '...logic is only a way of being ignorant by numbers.',
    'The desert wasn’t mappable. It ate map-makers.',
    'Don\'t panic.',
    'Time is an illusion. Lunchtime doubly so.',
    'Ford... you\'re turning into a penguin. Stop it.',
    '"Forty-two," said Deep Thought, with infinite majesty and calm.',
    'Thanks for all the fish.'
  ];

  constructor() {
    this.currentWord = sample(this.words);
  }

}
