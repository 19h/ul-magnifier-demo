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

// @ts-ignore
import styles from './ImageMagnifier.css';

import { treeWalker } from './treeWalker';

const DEFAULT_SCALE_FACTOR = 3;
const IMAGE_MAGNIFIER_MAX_WIDTH = 500; /* pixels */

export type RedPandaImage = Readonly<{
    url: string;
    width: number;
    height: number;
    ratio: number;
}>;

export type ImageMagnifierRelativeCoords = Readonly<{
    relX?: number,
    relY?: number,
    width: number,
    height: number,
}>;

export type ImageMagnifierMouseEvent = Readonly<{
    buttons?: number,
    which?: number
}>;

export type ImageMagnifierCanvasCommit = Readonly<{
    skewX: number,
    skewY: number,

    width: number,
    height: number,

    scaleFactor: number,
}>;

export interface ImageMagnifierProps {
    image: RedPandaImage;
    epoch?: number;
    scaleFactor?: number;

    onActive?: ( isActive: boolean ) => {};
    onClick?: ( changeSet: ImageMagnifierRelativeCoords, rerenderCallback: () => void ) => void;
    onMouseUp?: ( changeSet: ImageMagnifierRelativeCoords, rerenderCallback: () => void ) => void;
    onMouseDown?: ( changeSet: ImageMagnifierRelativeCoords, rerenderCallback: () => void ) => void;
    onMouseMove?: ( changeSet: ImageMagnifierRelativeCoords, eventData: ImageMagnifierMouseEvent, rerenderCallback: () => void ) => void;
    onCanvasCommit?: (
        context: CanvasRenderingContext2D,
        canvasCommit: ImageMagnifierCanvasCommit,
        state: ImageMagnifierExportedState
    ) => void;
}

interface ImageMagnifierState {
    active: boolean;
    hasAcquiredImageRects: boolean;

    height: number;
    width: number;

    knownImage: RedPandaImage;

    imageRef: HTMLImageElement;
}

export type ImageMagnifierExportedState = Readonly<{
    active: ImageMagnifierState[ 'active' ],
    width: ImageMagnifierState[ 'width' ],
    height: ImageMagnifierState[ 'height' ],
}>;

export class ImageMagnifier extends React.PureComponent<ImageMagnifierProps, ImageMagnifierState> {
    protected _canvasRef: React.RefObject<HTMLCanvasElement>;
    protected _rootRef: React.RefObject<HTMLDivElement>;
    protected _imageRef: React.RefObject<HTMLImageElement>;
    protected _cachedImageRef: HTMLImageElement;

    protected _canvasKnownImage: RedPandaImage;
    protected _savedRelativeCoords?: ImageMagnifierRelativeCoords;

    constructor( props: ImageMagnifierProps, state: ImageMagnifierState ) {
        super( props );

        this.state = state;

        this._rootRef = React.createRef();
        this._canvasRef = React.createRef();
        this._imageRef = React.createRef();

        this._cachedImageRef = null;
        this._canvasKnownImage = null;

        this._savedRelativeCoords = null;
    }

    private static _getDPI() {
        return window.devicePixelRatio || 1;
    }

    private static _getRelativeCoordsFromEvent( event: MouseEvent ): ImageMagnifierRelativeCoords {
        return ImageMagnifier._getRelativeCoordsFromNode(
            event,
            event.target as HTMLDivElement,
        );
    }

    private static _getRelativeCoordsFromNode(
        event: MouseEvent,
        node: Element,
    ): ImageMagnifierRelativeCoords {
        const ebcr = node.getBoundingClientRect();

        const refX = event.clientX - ebcr.left;
        const refY = event.clientY - ebcr.top;

        return {
            relX: refX / ebcr.width,
            relY: refY / ebcr.height,

            width: ebcr.width,
            height: ebcr.height,
        };
    }

    private static _getCanvasNodeFromEvent(event: Event) {
        let canvasNode = null;

        treeWalker(
            event.target as Element,
            node => {
                if (node.constructor === HTMLCanvasElement) {
                    canvasNode = node;
                }
            }
        );

        return canvasNode;
    }

    private _getCachedImageRefIfNeeded() {
        if ( this._imageRef.current !== null ) {
            this._cachedImageRef = this._imageRef.current;
        }

        return this._cachedImageRef;
    }

    private _getCanvasCommitFromRelativeCoords( coords: ImageMagnifierRelativeCoords ) {
        const { relX, relY, width, height } = coords;

        const dpi = ImageMagnifier._getDPI();

        const scaleFactor = this.props.scaleFactor || DEFAULT_SCALE_FACTOR;
        const bleedVec = -1 * ( scaleFactor - 1 );

        const skewX = bleedVec * width * relX * dpi;
        const skewY = bleedVec * height * relY * dpi;

        return {
            // scale image so that it bleeds out from the canvas
            width: width * scaleFactor * dpi,
            height: height * scaleFactor * dpi,

            // how far to bleed-out the image to the top and left;
            // creates a 'Imagemagnifier glass' effect
            skewX,
            skewY,

            // Although this is an intrinsic, expose this as part of
            // the commit so that external callbacks can leverage the
            // scale factor.
            scaleFactor: scaleFactor * dpi,
        } as ImageMagnifierCanvasCommit;
    }

    private _drawImageWithCoords( context: CanvasRenderingContext2D, coords: ImageMagnifierCanvasCommit ) {
        const { skewX, skewY, width, height } = coords;

        context.drawImage(
            this._getCachedImageRefIfNeeded(),

            // how far to bleed-out the image to the top and left;
            // creates a 'Imagemagnifier glass' effect
            skewX,
            skewY,

            // scale image so that it bleeds out from the canvas
            width,
            height
        );
    }

    private _getExportableState(): ImageMagnifierExportedState {
        return {
            active: this.state.active,
            width: this.state.width,
            height: this.state.height,
        };
    }

    private _resetCanvas() {
        if ( this._canvasRef.current === null ) {
            return;
        }

        const context = this._canvasRef.current.getContext( '2d' );

        const canvasCommit = {
            // X,Y: draw image from (0,0)(top, left)
            skewX: 0,
            skewY: 0,

            // w, h: image dimensions
            width: this.state.width,
            height: this.state.height,

            scaleFactor: ImageMagnifier._getDPI(),
        };

        this._drawImageWithCoords( context, canvasCommit );

        if ( this.props.onCanvasCommit ) {
            this.props.onCanvasCommit( context, canvasCommit, this._getExportableState() );
        }
    }

    private _tryRenderCommitWithCoords( coords: ImageMagnifierRelativeCoords ) {
        if ( this._canvasRef.current === null ) {
            return;
        }

        const context = this._canvasRef.current.getContext( '2d' );

        const canvasCommit = this._getCanvasCommitFromRelativeCoords( coords );

        this._drawImageWithCoords( context, canvasCommit );

        if ( this.props.onCanvasCommit ) {
            this.props.onCanvasCommit( context, canvasCommit, this._getExportableState() );
        }
    }

    componentDidUpdate() {
        if ( !this._savedRelativeCoords ) {
            this._resetCanvas();

            return;
        }

        this._tryRenderCommitWithCoords( this._savedRelativeCoords );

        requestAnimationFrame( () => {
            this._savedRelativeCoords = null;
        } );

        return;
    }

    private _acquireImageRects = event => {
        this._canvasKnownImage = this.props.image;

        const { width, height } = ImageMagnifier._getRelativeCoordsFromEvent( event );

        this._getCachedImageRefIfNeeded();

        const dpi = ImageMagnifier._getDPI();

        this.setState( {
            hasAcquiredImageRects: true,
            width: width * dpi,
            height: height * dpi,
        }, () => {
            this._resetCanvas();
        } );
    }

    private _handleMouseMove = event => {
        const canvasNode = ImageMagnifier._getCanvasNodeFromEvent(event);

        const relativeCoords = ImageMagnifier._getRelativeCoordsFromNode(
            event,
            canvasNode,
        );

        const { width, height } = relativeCoords;

        if ( this.props.onMouseMove ) {
            const eventData: ImageMagnifierMouseEvent = {
                buttons: event.buttons,
                which: event.which
            };

            const rerenderCallback = () => {
                this._savedRelativeCoords = relativeCoords;
                this._tryRenderCommitWithCoords( relativeCoords );
            };

            this.props.onMouseMove( relativeCoords, eventData, rerenderCallback );
        }

        if ( this._imageRef.current !== null ) {
            this._cachedImageRef = this._imageRef.current;
        }

        this._tryRenderCommitWithCoords( relativeCoords );

        if ( this.state.active ) {
            return;
        }

        const dpi = ImageMagnifier._getDPI();

        this.setState( {
            active: true,
            width: width * dpi,
            height: height * dpi
        }, () => {
            if ( this.props.onActive ) {
                this.props.onActive( true );
            }
        } );
    }

    private _handleMouseLeave = () => {
        this.setState( {
            active: false
        }, () => {
            this._resetCanvas();

            if ( this.props.onActive ) {
                this.props.onActive( false );
            }
        } );
    }

    private _handleClick = event => {
        if ( !this.props.onClick ) {
            return;
        }

        const relativeCoords = ImageMagnifier._getRelativeCoordsFromEvent( event );

        const rerenderCallback = () => {
            this._savedRelativeCoords = relativeCoords;
            this._tryRenderCommitWithCoords( relativeCoords );
        };

        this.props.onClick( relativeCoords, rerenderCallback );
    }

    private _handleMouseEnter = event => {
        // not implemented

        // TODO: implement behavior that exposes mouse move
        //       events for when a user returns into the
        //       magnifier canvas area.
    }

    private _handleMouseDown = event => {
        if ( !this.props.onMouseDown ) {
            return;
        }

        const relativeCoords = ImageMagnifier._getRelativeCoordsFromEvent( event );

        const rerenderCallback = () => {
            this._savedRelativeCoords = relativeCoords;
            this._tryRenderCommitWithCoords( relativeCoords );
        };

        this.props.onMouseDown( relativeCoords, rerenderCallback );
    }

    private _handleMouseUp = event => {
        if ( !this.props.onMouseUp ) {
            return;
        }

        const relativeCoords = ImageMagnifier._getRelativeCoordsFromEvent( event );

        const rerenderCallback = () => {
            this._savedRelativeCoords = relativeCoords;
            this._tryRenderCommitWithCoords( relativeCoords );
        };

        this.props.onMouseUp( relativeCoords, rerenderCallback );
    }

    private _getRelevantImageContainer() {
        const pointerHandlers = {
            onMouseMove: this._handleMouseMove,
            onMouseLeave: this._handleMouseLeave,
            onMouseEnter: this._handleMouseEnter,
            onMouseUp: this._handleMouseUp,
            onMouseDown: this._handleMouseDown,
            onClick: this._handleClick,
        };

        const hasImageChanged = this._canvasKnownImage && this._canvasKnownImage.url !== this.props.image.url;

        const maxWidthStyle = {
            maxWidth: `${IMAGE_MAGNIFIER_MAX_WIDTH}px`
        };

        if ( !hasImageChanged && ( this.state.active || this.state.hasAcquiredImageRects ) ) {
            return <canvas
                ref={ this._canvasRef }
                className={ styles.canvas }
                style={ maxWidthStyle }
                width={ this.state.width }
                height={ this.state.height }
                { ...pointerHandlers }
            />;
        }

        /*
         * The image is only used to obtain the rectangle
         * dimensions which we will use to render the
         * canvas accordingly.
         */
        return <img
            ref={ this._imageRef }
            className={ styles.img }
            style={ maxWidthStyle }
            src={ this.props.image.url }
            onLoad={ this._acquireImageRects }
            { ...pointerHandlers }
        />;
    }

    render() {
        return <div
            ref={ this._rootRef }
        >
            { this._getRelevantImageContainer() }
        </div>;
    }
}
