/*
 * Copyright (C) 2019 Styla GmbH. All rights reserved.
 *
 * This document is the property of Styla GmbH.
 * It is considered proprietary.
 *
 * This document may not be reproduced or transmitted in any form,
 * in whole or in part, without the express written permission of
 * Styla GmbH.
 */

import * as React from 'react';
import * as ReactDOM from 'react-dom';

import {ImageMagnifier} from './ImageMagnifier';

window.addEventListener(
    'load',
    () => {
        console.log(document.querySelector('.root'));
        ReactDOM.render(
            <ImageMagnifier
                image={
                    {
                        url: 'https://i.imgur.com/kbRfRSt.jpg',
                        width: 4032,
                        height: 3024,
                        ratio: 0.75
                    }
                }
            />,
            document.querySelector('.root'),
        );
    }
);
