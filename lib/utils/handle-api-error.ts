import { UseFormSetError } from 'react-hook-form'

type ApiErrorResponse = {
  non_field_errors?: string[]
  detail?: string
  message?: string
  errors?: string[] | Record<string, any> | any
  [key: string]: string[] | string | Record<string, any> | undefined
}

type ErrorHandlingResult = {
  hasFieldErrors: boolean
  message: string
}

export function handleApiError(
  error: any,
  setFormError?: UseFormSetError<any>
): ErrorHandlingResult {
  // Handle Error instances
  if (error instanceof Error) {
    return {
      hasFieldErrors: false,
      message: error.message || 'An unexpected error occurred'
    };
  }

  // If error is not an object, return a generic message
  if (!error || typeof error !== 'object') {
    return {
      hasFieldErrors: false,
      message: 'An unexpected error occurred'
    };
  }

  let errorData: ApiErrorResponse = error;

  // Handle Django REST Framework 'detail' field (most common)
  if (errorData.detail) {
    const detail = typeof errorData.detail === 'string' 
      ? errorData.detail 
      : Array.isArray(errorData.detail) 
        ? errorData.detail[0] 
        : String(errorData.detail);
    return {
      hasFieldErrors: false,
      message: detail
    };
  }

  // Handle 'message' field
  if (errorData.message && typeof errorData.message === 'string') {
    return {
      hasFieldErrors: false,
      message: errorData.message
    };
  }

  // Handle 'errors' field that might be an array or object
  if (errorData.errors) {
    if (Array.isArray(errorData.errors) && errorData.errors.length > 0) {
      const firstError = errorData.errors[0];
      return {
        hasFieldErrors: false,
        message: typeof firstError === 'string' ? firstError : String(firstError)
      };
    } else if (typeof errorData.errors === 'object') {
      // If errors is an object, try to extract a meaningful message
      const errorEntries = Object.entries(errorData.errors);
      if (errorEntries.length > 0) {
        const [key, value] = errorEntries[0];
        if (Array.isArray(value) && value.length > 0) {
          return {
            hasFieldErrors: true,
            message: `${key}: ${value[0]}`
          };
        } else if (typeof value === 'string') {
          return {
            hasFieldErrors: true,
            message: `${key}: ${value}`
          };
        }
      }
    }
  }

  // Handle non-field errors
  if (errorData.non_field_errors?.length) {
    return {
      hasFieldErrors: false,
      message: errorData.non_field_errors[0]
    };
  }

  // Handle field-specific errors
  const fieldErrors = Object.entries(errorData)
    .filter(([key]) => 
      key !== 'non_field_errors' && 
      key !== 'detail' && 
      key !== 'message' && 
      key !== 'errors' &&
      key !== 'status' &&
      key !== 'statusText'
    );

  if (setFormError) {
    fieldErrors.forEach(([field, errors]) => {
      if (Array.isArray(errors) && errors.length > 0) {
        const errorMessage = typeof errors[0] === 'string' ? errors[0] : String(errors[0]);
        setFormError(field, { message: errorMessage });
      } else if (typeof errors === 'string') {
        setFormError(field, { message: errors });
      }
    });
  }

  const firstFieldError = fieldErrors.find(([_, errors]) => {
    if (Array.isArray(errors) && errors.length > 0) {
      return true;
    }
    if (typeof errors === 'string') {
      return true;
    }
    return false;
  });

  if (firstFieldError) {
    const [field, errors] = firstFieldError;
    let errorMessage = '';
    if (Array.isArray(errors) && errors.length > 0) {
      errorMessage = typeof errors[0] === 'string' ? errors[0] : String(errors[0]);
    } else if (typeof errors === 'string') {
      errorMessage = errors;
    }
    
    return {
      hasFieldErrors: fieldErrors.length > 0,
      message: errorMessage ? `${field}: ${errorMessage}` : 'An unexpected error occurred'
    };
  }

  return {
    hasFieldErrors: false,
    message: 'An unexpected error occurred'
  };
}