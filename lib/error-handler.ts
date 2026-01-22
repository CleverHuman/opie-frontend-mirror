import * as Sentry from "@sentry/nextjs";

interface ErrorContext {
  action?: string;
  agentId?: string;
  apiResponse?: any;
  component?: string;
  componentStack?: string;
  currentPath?: string;
  language?: string;
  localStorage?: string;
  online?: boolean;
  originalError?: any;
  originalErrorConstructor?: string;
  originalErrorType?: string;
  screenSize?: string;
  sessionStorage?: string;
  timestamp?: string;
  url?: string;
  userAgent?: string;
  viewportSize?: string;
  [key: string]: any; // Allow additional custom fields
}

export class ErrorHandler {
  static captureException(error: unknown, context?: ErrorContext) {
    let processedError: Error;
    let errorMessage: string;

    if (error instanceof Error) {
      processedError = error;
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      processedError = new Error(error);
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      // Handle API error objects like {"agent_id":"Agent with this agent_id does not exist."}
      try {
        errorMessage = JSON.stringify(error);
        processedError = new Error(errorMessage);
      } catch (stringifyError) {
        errorMessage = 'Unknown error object';
        processedError = new Error(errorMessage);
      }
    } else {
      errorMessage = 'Unknown error type';
      processedError = new Error(errorMessage);
    }

    // Collect additional context data
    const additionalContext = ErrorHandler.collectContextData(context);

    console.error('Error captured:', {
      originalError: error,
      processedError: processedError,
      message: errorMessage,
      ...additionalContext,
    });

    // Send to Sentry with all context data
    Sentry.captureException(processedError, {
      tags: {
        component: context?.component || 'unknown',
        action: context?.action,
        agentId: context?.agentId,
        ...context,
      },
      contexts: {
        app: {
          name: 'opie-frontend',
          version: '1.0.0',
        },
        browser: {
          name: ErrorHandler.getBrowserName(),
          version: ErrorHandler.getBrowserVersion(),
          online: navigator.onLine,
          userAgent: navigator.userAgent,
        },
        device: {
          screenSize: `${screen.width}x${screen.height}`,
          viewportSize: `${window.innerWidth}x${window.innerHeight}`,
        },
        runtime: {
          name: 'browser',
          version: navigator.userAgent,
        },
      },
      extra: {
        ...additionalContext,
        originalError: error,
        originalErrorConstructor: error?.constructor?.name,
        originalErrorType: typeof error,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        currentPath: window.location.pathname,
        language: navigator.language,
        localStorage: ErrorHandler.getLocalStorageData(),
        sessionStorage: ErrorHandler.getSessionStorageData(),
      },
    });
  }

  static captureChatError(error: unknown, context?: ErrorContext) {
    try {
      let processedError: Error;
      let errorMessage: string;
      let originalError = error; // Store the original error

      if (error instanceof Error) {
        processedError = error;
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        processedError = new Error(error);
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        // Handle API error objects like {"agent_id":"Agent with this agent_id does not exist."}
        try {
          errorMessage = JSON.stringify(error);
          processedError = new Error(errorMessage);
          // Keep the original error object for context
          originalError = error;
        } catch (stringifyError) {
          errorMessage = 'Unknown error object';
          processedError = new Error(errorMessage);
        }
      } else {
        errorMessage = 'Unknown error type';
        processedError = new Error(errorMessage);
      }

      // Collect additional context data
      const additionalContext = ErrorHandler.collectContextData(context);

      // Create the final error object for console logging
      const errorLogData = {
        originalError: originalError,
        processedError: processedError,
        message: errorMessage,
        ...additionalContext,
      };
      
      // Ensure originalError is not overwritten by additionalContext
      errorLogData.originalError = originalError;

      console.log('Chat error captured (full details):', errorLogData);
      //console.error('Chat error captured - see console.log above for full details');

      // Send to Sentry with all context data
      try {
        Sentry.captureException(processedError, {
          tags: {
            component: 'chat',
            action: context?.action,
            agentId: context?.agentId,
            ...context,
          },
          contexts: {
            app: {
              name: 'opie-frontend',
              version: '1.0.0',
            },
            browser: {
              name: ErrorHandler.getBrowserName(),
              version: ErrorHandler.getBrowserVersion(),
              online: typeof navigator !== 'undefined' ? navigator.onLine : false,
              userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
            },
            device: {
              screenSize: typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : 'unknown',
              viewportSize: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'unknown',
            },
            runtime: {
              name: 'browser',
              version: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
            },
          },
          extra: {
            ...additionalContext,
            originalError: originalError,
            originalErrorConstructor: originalError?.constructor?.name,
            originalErrorType: typeof originalError,
            timestamp: new Date().toISOString(),
            url: typeof window !== 'undefined' ? window.location.href : 'server-side',
            currentPath: typeof window !== 'undefined' ? window.location.pathname : 'server-side',
            language: typeof navigator !== 'undefined' ? navigator.language : 'unknown',
            localStorage: ErrorHandler.getLocalStorageData(),
            sessionStorage: ErrorHandler.getSessionStorageData(),
          },
        });
      } catch (sentryError) {
        console.error('Error calling Sentry.captureException:', sentryError);
      }
    } catch (processingError) {
      console.error('Error in captureChatError processing:', processingError);
      console.error('Original error that caused processing failure:', error);
    }
  }

  private static collectContextData(context?: ErrorContext): ErrorContext {
    const collectedData = {
      action: context?.action,
      agentId: context?.agentId,
      apiResponse: context?.apiResponse,
      component: context?.component || 'chat',
      componentStack: context?.componentStack,
      currentPath: typeof window !== 'undefined' ? window.location.pathname : 'server-side',
      language: typeof navigator !== 'undefined' ? navigator.language : 'unknown',
      localStorage: ErrorHandler.getLocalStorageData(),
      online: typeof navigator !== 'undefined' ? navigator.onLine : false,
      originalError: context?.originalError,
      originalErrorConstructor: context?.originalErrorConstructor,
      originalErrorType: context?.originalErrorType,
      screenSize: typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : 'unknown',
      sessionStorage: ErrorHandler.getSessionStorageData(),
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : 'server-side',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      viewportSize: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'unknown',
      ...context, // Include any additional custom fields
    };
    
    return collectedData;
  }

  private static getLocalStorageData(): string {
    if (typeof window === 'undefined') return 'localStorage not available (SSR)';
    try {
      return localStorage.length > 0 ? localStorage.length.toString() : 'localStorage empty';
    } catch (error) {
      return 'localStorage access denied';
    }
  }

  private static getSessionStorageData(): string {
    try {
      return sessionStorage.length > 0 ? sessionStorage.length.toString() : 'sessionStorage empty';
    } catch (error) {
      return 'sessionStorage access denied';
    }
  }

  private static getBrowserName(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  private static getBrowserVersion(): string {
    const userAgent = navigator.userAgent;
    const match = userAgent.match(/(chrome|firefox|safari|edge)\/(\d+)/i);
    return match ? match[2] : 'Unknown';
  }
}

// Export convenience functions
export const captureException = ErrorHandler.captureException;
export const captureChatError = ErrorHandler.captureChatError; 