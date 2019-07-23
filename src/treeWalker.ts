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

type TreeNode = HTMLElement | Node | ChildNode;

export const treeWalker = (target: TreeNode, iteratorFn: (node: TreeNode) => void) => {
    const recursor = (node: TreeNode) => {
        iteratorFn(node);

        // if there is a `firstChild`, continue in its subtree.
        if (node.firstChild) {
            recursor(node.firstChild);
        }

        // if there is a nextSibling, which is not the root element,
        // call the recursor to walk its tree.
        if (node !== target && node.nextSibling) {
            recursor(node.nextSibling);
        }
    };

    recursor(target);
};

